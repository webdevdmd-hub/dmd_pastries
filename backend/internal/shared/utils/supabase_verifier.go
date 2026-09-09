package utils

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
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
type SupabaseVerifier struct {
	issuer    string
	jwtSecret []byte
	appEnv    string
	e2eToken  string
}

// ErrSupabaseNotConfigured is returned when no Supabase credentials are set.
// This is the normal state before cutover, not a failure: the dual-verify path
// treats it as "not a Supabase token" and falls through to Appwrite.
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
	}
}

// Configured reports whether this verifier can check anything at all. Callers
// use it to decide whether the Supabase path is live, so that an unconfigured
// deployment behaves exactly as it did before the column and the verifier
// existed.
func (v *SupabaseVerifier) Configured() bool {
	return v.issuer != "" && len(v.jwtSecret) > 0
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
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		// Without this the token itself chooses the algorithm, and "alg": "none"
		// or an HMAC-over-a-public-key swap verifies happily.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", t.Header["alg"])
		}
		return v.jwtSecret, nil
	},
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

	// The anon and service_role API keys are themselves JWTs signed with this
	// same secret. A verifier that stops at the signature accepts the anon key
	// -- which is published in the frontend bundle -- as a valid login, and the
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
