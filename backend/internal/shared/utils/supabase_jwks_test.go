package utils

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"pastries-pos/internal/config"
)

// The asymmetric path. Supabase projects created since 2025 sign access tokens
// with ES256 and publish the public key; this project is one of them. The
// verifier only understood HS256 until 2026-09-09, so with the JWT secret set
// perfectly, every real login would have been rejected on cutover day.

func newSigningKey(t *testing.T) *ecdsa.PrivateKey {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	return key
}

// jwkOf renders a public key the way GoTrue publishes it.
//
// Bytes() is the uncompressed point, 0x04 || X || Y, with both coordinates
// already padded to the curve size -- which is exactly the split a JWK wants.
func jwkOf(t *testing.T, key *ecdsa.PublicKey, kid string) map[string]any {
	t.Helper()
	point, err := key.Bytes()
	if err != nil {
		t.Fatalf("encode public key: %v", err)
	}
	size := (len(point) - 1) / 2
	return map[string]any{
		"kty": "EC", "crv": "P-256", "alg": "ES256", "use": "sig", "kid": kid,
		"x": base64.RawURLEncoding.EncodeToString(point[1 : 1+size]),
		"y": base64.RawURLEncoding.EncodeToString(point[1+size:]),
	}
}

// jwksProject stands in for a Supabase project: it serves a JWKS document and
// counts how often it is asked for one. The verifier is pointed at it as the
// project URL, so the issuer and the JWKS endpoint both resolve here.
type jwksProject struct {
	server  *httptest.Server
	fetches atomic.Int32
	keys    func() []map[string]any
	status  int
}

func newJWKSProject(t *testing.T, keys ...map[string]any) *jwksProject {
	t.Helper()
	p := &jwksProject{status: http.StatusOK, keys: func() []map[string]any { return keys }}
	p.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/auth/v1/.well-known/jwks.json" {
			http.NotFound(w, r)
			return
		}
		p.fetches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(p.status)
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": p.keys()})
	}))
	t.Cleanup(p.server.Close)
	return p
}

func (p *jwksProject) issuer() string { return p.server.URL + "/auth/v1" }

// verifier builds one with no JWT secret at all -- the shape of a deployment
// on an asymmetric project.
func (p *jwksProject) verifier() *SupabaseVerifier {
	return NewSupabaseVerifier(config.Config{SupabaseURL: p.server.URL, AppEnv: "production"})
}

func (p *jwksProject) claims() jwt.MapClaims {
	c := validClaims()
	c["iss"] = p.issuer()
	return c
}

func signES(t *testing.T, key *ecdsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	if kid != "" {
		token.Header["kid"] = kid
	}
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign ES256: %v", err)
	}
	return signed
}

func TestAcceptsAnES256SessionSignedByThePublishedKey(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	verifier := project.verifier()

	if !verifier.Configured() {
		t.Fatal("a project URL alone must be enough; the secret is optional on an asymmetric project")
	}

	identity, err := verifier.VerifyToken(signES(t, key, "kid-1", project.claims()))
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if identity.ID != testSubject || identity.Email != "owner@test.invalid" {
		t.Errorf("identity = %+v", identity)
	}
	if !identity.IsSupabase() {
		t.Error("identity was not tagged as Supabase")
	}
}

// A correct kid with the wrong private key is the forgery case. The cache
// holds the real public key, so the signature simply fails.
func TestRejectsAnES256TokenSignedByAnotherKey(t *testing.T) {
	real, forged := newSigningKey(t), newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &real.PublicKey, "kid-1"))

	_, err := project.verifier().VerifyToken(signES(t, forged, "kid-1", project.claims()))
	if err == nil {
		t.Fatal("a token signed by a key the project never published was accepted")
	}
}

// An unknown key id is what rotation looks like, so it earns one refetch.
// Only one: otherwise a stream of tokens with invented ids becomes a way to
// make this server hammer GoTrue.
func TestUnknownKeyIdRefetchesOnceThenRejects(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	verifier := project.verifier()

	// Warm the cache with a good token.
	if _, err := verifier.VerifyToken(signES(t, key, "kid-1", project.claims())); err != nil {
		t.Fatalf("warm-up: %v", err)
	}
	if got := project.fetches.Load(); got != 1 {
		t.Fatalf("fetches after warm-up = %d, want 1", got)
	}

	// Force the refresh window open, then present an id the project never had.
	verifier.keys.fetchedAt = time.Now().Add(-2 * jwksRefreshInterval)
	_, err := verifier.VerifyToken(signES(t, key, "kid-rotated-away", project.claims()))
	if err == nil {
		t.Fatal("a token with an unknown key id was accepted")
	}
	if !strings.Contains(err.Error(), "unknown key id") {
		t.Errorf("err = %v, want it to name the unknown key id", err)
	}
	if got := project.fetches.Load(); got != 2 {
		t.Errorf("fetches = %d, want exactly 2 (one warm-up, one refresh)", got)
	}

	// Inside the window, the same bad id must not fetch again.
	_, _ = verifier.VerifyToken(signES(t, key, "kid-still-unknown", project.claims()))
	if got := project.fetches.Load(); got != 2 {
		t.Errorf("fetches = %d after a second unknown id inside the refresh window, want 2", got)
	}
}

// Rotation, end to end: a new key appears in the JWKS, and a token signed with
// it is accepted after one refresh.
func TestPicksUpARotatedKey(t *testing.T) {
	old, next := newSigningKey(t), newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &old.PublicKey, "kid-old"))
	verifier := project.verifier()

	if _, err := verifier.VerifyToken(signES(t, old, "kid-old", project.claims())); err != nil {
		t.Fatalf("before rotation: %v", err)
	}

	project.keys = func() []map[string]any {
		return []map[string]any{jwkOf(t, &old.PublicKey, "kid-old"), jwkOf(t, &next.PublicKey, "kid-new")}
	}
	verifier.keys.fetchedAt = time.Now().Add(-2 * jwksRefreshInterval)

	if _, err := verifier.VerifyToken(signES(t, next, "kid-new", project.claims())); err != nil {
		t.Fatalf("after rotation: %v", err)
	}
}

// The downgrade that must not work. With no secret configured, an HMAC over an
// empty key is still a valid HMAC -- so the only safe answer to an HS256 token
// on a keyless deployment is no.
func TestRefusesHMACWhenNoSecretIsConfigured(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	verifier := project.verifier()

	claims := project.claims()
	for _, secret := range []string{"", "guess", testSecret} {
		token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
		if err != nil {
			t.Fatalf("sign HS256: %v", err)
		}
		_, err = verifier.VerifyToken(token)
		if err == nil {
			t.Fatalf("an HS256 token (secret %q) was accepted by a verifier with no secret", secret)
		}
		if !strings.Contains(err.Error(), "no JWT secret") {
			t.Errorf("secret %q: err = %v, want the refusal to say why", secret, err)
		}
	}
	if got := project.fetches.Load(); got != 0 {
		t.Errorf("an HMAC token caused %d JWKS fetch(es); it should be refused before any network call", got)
	}
}

// The cache is the point: one fetch, many tokens.
func TestTheKeyIsFetchedOnceAndReused(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	verifier := project.verifier()

	for i := 0; i < 5; i++ {
		if _, err := verifier.VerifyToken(signES(t, key, "kid-1", project.claims())); err != nil {
			t.Fatalf("token %d: %v", i, err)
		}
	}
	if got := project.fetches.Load(); got != 1 {
		t.Errorf("fetches = %d for five tokens, want 1", got)
	}
}

// GoTrue being down is a 401 for the user and an error in the log, not a
// panic and not an accept.
func TestAnUnreachableJWKSFailsClosed(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	project.status = http.StatusInternalServerError

	_, err := project.verifier().VerifyToken(signES(t, key, "kid-1", project.claims()))
	if err == nil {
		t.Fatal("a token was accepted while the project's keys could not be fetched")
	}
	if !strings.Contains(err.Error(), "signing keys") {
		t.Errorf("err = %v, want it to say the keys could not be fetched", err)
	}
}

// The anon and service_role keys are rejected on the asymmetric path for the
// same reason as on HS256: wrong role, no subject. The signature being valid is
// exactly the situation the role check exists for.
func TestRejectsTheAnonKeyEvenWhenCorrectlySignedWithES256(t *testing.T) {
	key := newSigningKey(t)
	project := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))

	anon := project.claims()
	anon["role"] = "anon"
	delete(anon, "sub")

	_, err := project.verifier().VerifyToken(signES(t, key, "kid-1", anon))
	if err == nil {
		t.Fatal("the anon key was accepted as a user session")
	}
}

// A token with no kid is fine while the project publishes one key, and
// ambiguous -- so refused -- once it publishes two.
func TestAMissingKeyIdIsOnlyAcceptedWhenThereIsOneKey(t *testing.T) {
	key, other := newSigningKey(t), newSigningKey(t)

	single := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"))
	if _, err := single.verifier().VerifyToken(signES(t, key, "", single.claims())); err != nil {
		t.Errorf("one published key, no kid: %v", err)
	}

	double := newJWKSProject(t, jwkOf(t, &key.PublicKey, "kid-1"), jwkOf(t, &other.PublicKey, "kid-2"))
	if _, err := double.verifier().VerifyToken(signES(t, key, "", double.claims())); err == nil {
		t.Error("two published keys, no kid: accepted, but there is nothing to say which key was meant")
	}
}

// HS256 keeps working for a project that still uses it -- but only with the
// secret the operator set.
func TestHS256StillWorksWhenASecretIsConfigured(t *testing.T) {
	verifier := testVerifier(t, "production", "")
	if _, err := verifier.VerifyToken(sign(t, validClaims())); err != nil {
		t.Fatalf("HS256 with a configured secret: %v", err)
	}
}
