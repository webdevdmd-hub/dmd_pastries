package utils

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"pastries-pos/internal/config"
)

// SupabaseVerifier checks a Supabase access token locally.
//
// The Appwrite path does not do this: it replays the token to Appwrite's
// /account endpoint and treats whatever comes back as the identity, which costs
// an HTTP round trip on every authenticated request. Verifying a signature in
// process removes that hop entirely, which is the single biggest structural win
// in the migration.
//
// It also moves a trust boundary. Appwrite's answer came from Appwrite; a
// locally verified JWT is only as trustworthy as the checks below, so they are
// deliberately strict and each one is tested.
//
// Two signing schemes are accepted, and which one a project uses is not a
// choice this code gets to make. Supabase projects created since 2025 sign
// access tokens with an asymmetric key (ES256 by default) and publish the
// public half at /auth/v1/.well-known/jwks.json; older projects, and any
// project that has not migrated, use a shared HS256 secret. The first version
// of this verifier handled only HS256, and this project turned out to be
// ES256 -- so every real login would have been rejected on the first day of
// the cutover, with the JWT secret set perfectly. The asymmetric path is also
// the better one: the backend then holds no signing secret at all, and the key
// that signs tokens is the same key that signs the anon and service_role API
// keys, so a leaked HS256 secret is total compromise.
type SupabaseVerifier struct {
	issuer    string
	jwtSecret []byte
	appEnv    string
	e2eToken  string

	http *http.Client
	keys jwksCache
}

// jwksCache holds the project's public keys, fetched on first use and refreshed
// when a token names a key id it has not seen -- which is what key rotation
// looks like from here. The refresh is rate-limited so a flood of tokens with
// invented key ids cannot turn this into a request amplifier against GoTrue.
type jwksCache struct {
	mu        sync.Mutex
	byID      map[string]crypto.PublicKey
	fetchedAt time.Time
}

// jwksRefreshInterval is the minimum gap between two fetches triggered by an
// unknown key id. Rotation happens once in a long while; a minute of stale
// keys costs a few 401s during that minute and nothing else.
const jwksRefreshInterval = time.Minute

// ErrSupabaseNotConfigured is returned when no Supabase project is set. This is
// the normal state before cutover, not a failure: the dual-verify path treats
// it as "not a Supabase token" and falls through to Appwrite.
var ErrSupabaseNotConfigured = errors.New("supabase verification is not configured")

// supabaseAuthBaseURL turns SUPABASE_URL into the GoTrue base, and returns ""
// for anything it cannot make sense of.
//
// Failing closed matters here. This value is both the base for admin calls and
// the issuer a token must claim, and the issuer check is a security control --
// a malformed URL that silently became a malformed issuer would either reject
// every good token or, worse, match something unintended. An empty return makes
// Configured() false, which is the same inert state as no configuration at all.
//
// Accepts the project URL with or without a trailing slash, and with or without
// the /auth/v1 suffix already on it, because both are things people paste.
func supabaseAuthBaseURL(raw string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return ""
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return ""
	}

	if strings.HasSuffix(parsed.Path, "/auth/v1") {
		return trimmed
	}
	return trimmed + "/auth/v1"
}

func NewSupabaseVerifier(cfg config.Config) *SupabaseVerifier {
	return &SupabaseVerifier{
		issuer:    supabaseAuthBaseURL(cfg.SupabaseURL),
		jwtSecret: []byte(strings.TrimSpace(cfg.SupabaseJWTSecret)),
		appEnv:    cfg.AppEnv,
		e2eToken:  cfg.E2EAuthToken,
		// Short, because this runs inside a request that is waiting on it. A
		// GoTrue that takes longer than this to hand over a public key is a
		// GoTrue that is down, and a 401 now beats a hung request.
		http: &http.Client{Timeout: 5 * time.Second},
	}
}

// Configured reports whether this verifier can check anything at all. Callers
// use it to decide whether the Supabase path is live, so that an unconfigured
// deployment behaves exactly as it did before the column and the verifier
// existed.
//
// A project URL is enough. The JWT secret is only consulted for HS256 tokens,
// and a project that signs with a published key never issues one.
func (v *SupabaseVerifier) Configured() bool {
	return v.issuer != ""
}

// Issuer is the value a token's iss claim must carry to be considered ours.
func (v *SupabaseVerifier) Issuer() string {
	return v.issuer
}

// OwnsToken reports whether a token claims to come from our Supabase project,
// so the caller knows which verifier to hand it to. Both providers issue JWTs,
// and sending an Appwrite token through signature verification would reject a
// perfectly good session.
//
// This reads the issuer WITHOUT verifying the signature, which is safe only
// because the answer is used for routing and nothing else: a token that lies
// about its issuer to reach this path still has to survive VerifyToken, and a
// token that lies the other way falls through to Appwrite, which will reject it
// on its own terms. Never let an unverified claim decide anything but the route.
func (v *SupabaseVerifier) OwnsToken(token string) bool {
	if !v.Configured() {
		return false
	}

	claims := &jwt.RegisteredClaims{}
	if _, _, err := jwt.NewParser().ParseUnverified(strings.TrimSpace(token), claims); err != nil {
		return false
	}

	issuer, err := claims.GetIssuer()
	if err != nil {
		return false
	}
	return issuer == v.issuer
}

// supabaseClaims is the subset of a Supabase access token this app relies on.
// Anything not listed here is deliberately ignored; user_metadata in particular
// is user-writable and must never be used for authorization.
type supabaseClaims struct {
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Role         string `json:"role"`
	UserMetadata struct {
		EmailVerified bool   `json:"email_verified"`
		FullName      string `json:"full_name"`
		Name          string `json:"name"`
	} `json:"user_metadata"`
	jwt.RegisteredClaims
}

// VerifyToken validates a Supabase access token and returns the identity it
// names. It rejects anything it is not completely sure about.
func (v *SupabaseVerifier) VerifyToken(token string) (*AppwriteIdentity, error) {
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("missing token")
	}

	// The E2E bypass hands out a hardcoded owner identity for a shared string.
	// Rewriting token verification is exactly where that branch can become
	// reachable in production by accident, so the environment gate is asserted
	// here rather than inherited from a caller.
	if v.appEnv == "e2e" && v.e2eToken != "" && token == v.e2eToken {
		return &AppwriteIdentity{
			// Appwrite, deliberately: the E2E seed rows live in
			// appwrite_user_id, so tagging this Supabase would resolve
			// against an empty column.
			Provider:      ProviderAppwrite,
			ID:            "e2e-owner",
			Email:         "owner.e2e@pastries.local",
			Phone:         "+971500000000",
			Name:          "E2E Owner",
			EmailVerified: true,
		}, nil
	}

	if !v.Configured() {
		return nil, ErrSupabaseNotConfigured
	}

	claims := &supabaseClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, v.keyFor,
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid supabase token: %w", err)
	}
	if !parsed.Valid {
		return nil, errors.New("invalid supabase token")
	}

	// The anon and service_role API keys are themselves JWTs signed by the
	// project. A verifier that stops at the signature accepts the anon key --
	// which is published in the frontend bundle -- as a valid login, and the
	// service_role key as one with full database rights. Neither carries a sub,
	// and both carry a role other than "authenticated", so both checks below
	// are load-bearing rather than belt-and-braces.
	if claims.Role != "authenticated" {
		return nil, fmt.Errorf("token role %q is not a user session", claims.Role)
	}

	subject := strings.TrimSpace(claims.Subject)
	if subject == "" {
		return nil, errors.New("token has no subject")
	}
	if _, err := uuid.Parse(subject); err != nil {
		return nil, fmt.Errorf("token subject %q is not a uuid", subject)
	}

	name := claims.UserMetadata.FullName
	if name == "" {
		name = claims.UserMetadata.Name
	}

	return &AppwriteIdentity{
		Provider:      ProviderSupabase,
		ID:            subject,
		Email:         strings.TrimSpace(claims.Email),
		Phone:         strings.TrimSpace(claims.Phone),
		Name:          name,
		EmailVerified: claims.UserMetadata.EmailVerified,
	}, nil
}

// keyFor chooses the verification key from the token's declared algorithm.
//
// The algorithm is the token's claim about itself, so this is where the
// classic confusions are shut: "alg": "none" is refused by the default case,
// and an HMAC token is refused outright when there is no secret to check it
// against -- an HMAC over an empty key is a perfectly valid HMAC, so accepting
// one there would let anyone mint sessions. Only a secret the operator set is
// ever used as an HMAC key.
func (v *SupabaseVerifier) keyFor(t *jwt.Token) (interface{}, error) {
	switch t.Method.(type) {
	case *jwt.SigningMethodHMAC:
		if len(v.jwtSecret) == 0 {
			return nil, errors.New("HMAC-signed token but no JWT secret is configured; " +
				"this project signs with a published key")
		}
		return v.jwtSecret, nil
	case *jwt.SigningMethodECDSA, *jwt.SigningMethodRSA:
		kid, _ := t.Header["kid"].(string)
		return v.publicKey(kid)
	default:
		return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
	}
}

// publicKey returns the project's public key for a key id, fetching the JWKS
// on first use and once more if the id is unknown and enough time has passed.
func (v *SupabaseVerifier) publicKey(kid string) (crypto.PublicKey, error) {
	v.keys.mu.Lock()
	defer v.keys.mu.Unlock()

	if key, ok := v.lookupLocked(kid); ok {
		return key, nil
	}

	// Unknown key id, or nothing cached yet. Fetch, unless we fetched a moment
	// ago -- in which case the id really is unknown and the token is bad.
	if v.keys.fetchedAt.IsZero() || time.Since(v.keys.fetchedAt) >= jwksRefreshInterval {
		if err := v.refreshLocked(); err != nil {
			return nil, err
		}
		if key, ok := v.lookupLocked(kid); ok {
			return key, nil
		}
	}

	if kid == "" {
		return nil, errors.New("token names no key id and the project publishes more than one key")
	}
	return nil, fmt.Errorf("token signed with unknown key id %q", kid)
}

// lookupLocked finds a key by id. A token with no kid is accepted only when
// the project publishes exactly one key, so there is nothing to be ambiguous
// about.
func (v *SupabaseVerifier) lookupLocked(kid string) (crypto.PublicKey, bool) {
	if kid != "" {
		key, ok := v.keys.byID[kid]
		return key, ok
	}
	if len(v.keys.byID) == 1 {
		for _, key := range v.keys.byID {
			return key, true
		}
	}
	return nil, false
}

// refreshLocked replaces the cache with whatever the project publishes now.
func (v *SupabaseVerifier) refreshLocked() error {
	response, err := v.http.Get(v.issuer + "/.well-known/jwks.json")
	if err != nil {
		return fmt.Errorf("fetching project signing keys: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("fetching project signing keys: status %d", response.StatusCode)
	}

	var document struct {
		Keys []jsonWebKey `json:"keys"`
	}
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		return fmt.Errorf("decoding project signing keys: %w", err)
	}

	parsed := make(map[string]crypto.PublicKey, len(document.Keys))
	for _, entry := range document.Keys {
		key, err := entry.publicKey()
		if err != nil {
			// One unparseable key must not take the others down with it; a
			// project mid-rotation may publish a key type this code has never
			// seen. Skip it and let a token that needs it fail on its own.
			continue
		}
		parsed[entry.KeyID] = key
	}
	if len(parsed) == 0 {
		return errors.New("project publishes no usable signing keys")
	}

	v.keys.byID = parsed
	v.keys.fetchedAt = time.Now()
	return nil
}

// jsonWebKey is the part of a JWK this verifier needs: enough to rebuild an
// EC or RSA public key. Parsed here rather than through a library because the
// shape is small and stable, and the repository already has one JWT
// dependency more than it would like.
type jsonWebKey struct {
	KeyType string `json:"kty"`
	KeyID   string `json:"kid"`
	Curve   string `json:"crv"`
	X       string `json:"x"`
	Y       string `json:"y"`
	N       string `json:"n"`
	E       string `json:"e"`
}

func (k jsonWebKey) publicKey() (crypto.PublicKey, error) {
	switch k.KeyType {
	case "EC":
		var curve elliptic.Curve
		switch k.Curve {
		case "P-256":
			curve = elliptic.P256()
		case "P-384":
			curve = elliptic.P384()
		case "P-521":
			curve = elliptic.P521()
		default:
			return nil, fmt.Errorf("unsupported curve %q", k.Curve)
		}
		x, err := decodeJWKInt(k.X)
		if err != nil {
			return nil, err
		}
		y, err := decodeJWKInt(k.Y)
		if err != nil {
			return nil, err
		}
		// Rebuilt from the uncompressed encoding rather than by setting X and Y
		// on the struct: ParseUncompressedPublicKey checks that the point is on
		// the curve and yields a key the ecdsa package treats as well-formed. A
		// point that is not on the curve is not a key, and refusing it here
		// keeps the cache honest.
		size := (curve.Params().BitSize + 7) / 8
		if x.BitLen() > size*8 || y.BitLen() > size*8 {
			return nil, errors.New("EC coordinate is larger than the curve allows")
		}
		point := make([]byte, 1+2*size)
		point[0] = 4
		x.FillBytes(point[1 : 1+size])
		y.FillBytes(point[1+size:])
		key, err := ecdsa.ParseUncompressedPublicKey(curve, point)
		if err != nil {
			return nil, fmt.Errorf("EC point is not a valid public key: %w", err)
		}
		return key, nil

	case "RSA":
		n, err := decodeJWKInt(k.N)
		if err != nil {
			return nil, err
		}
		e, err := decodeJWKInt(k.E)
		if err != nil {
			return nil, err
		}
		if !e.IsInt64() || e.Int64() <= 0 {
			return nil, errors.New("RSA exponent out of range")
		}
		return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil

	default:
		return nil, fmt.Errorf("unsupported key type %q", k.KeyType)
	}
}

func decodeJWKInt(value string) (*big.Int, error) {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return nil, fmt.Errorf("decoding JWK value: %w", err)
	}
	if len(raw) == 0 {
		return nil, errors.New("empty JWK value")
	}
	return new(big.Int).SetBytes(raw), nil
}
