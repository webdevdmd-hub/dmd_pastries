package utils

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"pastries-pos/internal/config"
)

const (
	testProjectRef = "examplerefnotreal01"
	testSecret     = "test-jwt-secret-not-a-real-one"
	testIssuer     = "https://" + testProjectRef + ".supabase.co/auth/v1"
	testSubject    = "6f1e2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b"
)

func testVerifier(t *testing.T, appEnv, e2eToken string) *SupabaseVerifier {
	t.Helper()
	return NewSupabaseVerifier(config.Config{
		SupabaseProjectRef: testProjectRef,
		SupabaseJWTSecret:  testSecret,
		AppEnv:             appEnv,
		E2EAuthToken:       e2eToken,
	})
}

// sign mints a token with the same secret the verifier trusts. Every negative
// case below is therefore correctly signed -- the point is that a valid
// signature is not, on its own, permission to log in.
func sign(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return token
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":   testIssuer,
		"aud":   "authenticated",
		"role":  "authenticated",
		"sub":   testSubject,
		"email": "owner@test.invalid",
		"exp":   time.Now().Add(time.Hour).Unix(),
		"user_metadata": map[string]any{
			"email_verified": true,
			"full_name":      "Bakery Owner",
		},
	}
}

func TestAcceptsAGenuineUserSession(t *testing.T) {
	identity, err := testVerifier(t, "production", "").VerifyToken(sign(t, validClaims()))
	if err != nil {
		t.Fatalf("a valid session token was rejected: %v", err)
	}
	if identity.ID != testSubject {
		t.Errorf("ID = %q, want the sub claim %q", identity.ID, testSubject)
	}
	if identity.Email != "owner@test.invalid" {
		t.Errorf("Email = %q", identity.Email)
	}
	if identity.Name != "Bakery Owner" {
		t.Errorf("Name = %q, want it read from user_metadata.full_name", identity.Name)
	}
	if !identity.EmailVerified {
		t.Error("EmailVerified = false, want true from user_metadata")
	}
}

// The single most important test in this package.
//
// Supabase's anon and service_role keys are JWTs signed with the same project
// secret as user sessions, and the anon key is published in the frontend
// bundle by design. A verifier that checks only the signature accepts the anon
// key as a valid login for whoever holds it -- which is everyone.
func TestRejectsTheAnonAndServiceRoleKeys(t *testing.T) {
	verifier := testVerifier(t, "production", "")

	for _, role := range []string{"anon", "service_role"} {
		// Shaped like a real API key: correctly signed, long-lived, no subject.
		t.Run(role+" key as issued", func(t *testing.T) {
			key := sign(t, jwt.MapClaims{
				"iss":  testIssuer,
				"aud":  "authenticated",
				"role": role,
				"exp":  time.Now().Add(10 * 365 * 24 * time.Hour).Unix(),
			})

			if _, err := verifier.VerifyToken(key); err == nil {
				t.Fatalf("the %s key was accepted as a user session", role)
			}
		})

		// The same role, but carrying a valid uuid subject, so the only thing
		// wrong with it is the role. Without this case the subject check does
		// all the rejecting and the role check is never exercised -- which is
		// exactly what a mutation test found on 2026-09-08, when deleting the
		// role gate left every test in this file still passing.
		t.Run(role+" role with a valid subject", func(t *testing.T) {
			claims := validClaims()
			claims["role"] = role

			if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
				t.Fatalf("role %q was accepted as a user session", role)
			}
		})
	}
}

// A subject that is present but not a uuid cannot address a row in
// users.supabase_user_id, so treating it as an identity would silently resolve
// to nobody -- or, worse, to whatever a later fallback decides.
func TestRejectsMalformedOrMissingSubject(t *testing.T) {
	verifier := testVerifier(t, "production", "")

	cases := map[string]any{
		"missing":    nil,
		"empty":      "",
		"not a uuid": "65f1a2b3c4d5e6f7a8b9", // an Appwrite-shaped id
	}

	for name, sub := range cases {
		t.Run(name, func(t *testing.T) {
			claims := validClaims()
			if sub == nil {
				delete(claims, "sub")
			} else {
				claims["sub"] = sub
			}
			if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
				t.Errorf("accepted a token whose sub was %v", sub)
			}
		})
	}
}

func TestRejectsWrongIssuerAudienceAndExpiry(t *testing.T) {
	verifier := testVerifier(t, "production", "")

	t.Run("another project's issuer", func(t *testing.T) {
		claims := validClaims()
		claims["iss"] = "https://someoneelse.supabase.co/auth/v1"
		if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
			t.Error("accepted a token minted for a different Supabase project")
		}
	})

	t.Run("wrong audience", func(t *testing.T) {
		claims := validClaims()
		claims["aud"] = "anon"
		if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
			t.Error("accepted a token with the wrong audience")
		}
	})

	t.Run("expired", func(t *testing.T) {
		claims := validClaims()
		claims["exp"] = time.Now().Add(-time.Hour).Unix()
		if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
			t.Error("accepted an expired token")
		}
	})

	t.Run("no expiry at all", func(t *testing.T) {
		claims := validClaims()
		delete(claims, "exp")
		if _, err := verifier.VerifyToken(sign(t, claims)); err == nil {
			t.Error("accepted a token that never expires")
		}
	})
}

// Without an explicit algorithm check the token chooses its own verification,
// and "alg": "none" verifies against nothing at all.
func TestRejectsUnsignedTokens(t *testing.T) {
	unsigned, err := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims()).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("mint unsigned: %v", err)
	}

	if _, err := testVerifier(t, "production", "").VerifyToken(unsigned); err == nil {
		t.Error("accepted an unsigned (alg=none) token")
	}
}

func TestRejectsATokenSignedWithTheWrongSecret(t *testing.T) {
	foreign, err := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims()).
		SignedString([]byte("not-the-project-secret"))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if _, err := testVerifier(t, "production", "").VerifyToken(foreign); err == nil {
		t.Error("accepted a token signed with a secret we do not trust")
	}
}

// The E2E bypass returns a hardcoded owner identity for a shared string. It is
// gated on APP_ENV, and rewriting token verification is precisely the change
// that could make it reachable in production.
func TestE2EBypassIsUnreachableOutsideE2E(t *testing.T) {
	const token = "e2e-shared-token"

	if _, err := testVerifier(t, "production", token).VerifyToken(token); err == nil {
		t.Fatal("the E2E bypass token authenticated while APP_ENV=production")
	}
	if _, err := testVerifier(t, "development", token).VerifyToken(token); err == nil {
		t.Error("the E2E bypass token authenticated while APP_ENV=development")
	}

	identity, err := testVerifier(t, "e2e", token).VerifyToken(token)
	if err != nil {
		t.Fatalf("the bypass should still work under APP_ENV=e2e: %v", err)
	}
	if identity.ID != "e2e-owner" {
		t.Errorf("bypass identity = %q, want e2e-owner", identity.ID)
	}
}

// Before cutover the Supabase environment variables are unset. That has to be a
// clean, recognisable "not mine" rather than an error the caller might mistake
// for a rejected credential, because the dual-verify path uses it to decide
// whether to fall through to Appwrite.
func TestUnconfiguredVerifierIsInert(t *testing.T) {
	verifier := NewSupabaseVerifier(config.Config{AppEnv: "production"})

	if verifier.Configured() {
		t.Error("Configured() is true with no project ref or secret")
	}

	_, err := verifier.VerifyToken(sign(t, validClaims()))
	if !errors.Is(err, ErrSupabaseNotConfigured) {
		t.Errorf("err = %v, want ErrSupabaseNotConfigured", err)
	}
}

func TestIssuerIsDerivedFromTheProjectRef(t *testing.T) {
	got := testVerifier(t, "production", "").Issuer()
	if !strings.Contains(got, testProjectRef) || !strings.HasSuffix(got, "/auth/v1") {
		t.Errorf("Issuer() = %q", got)
	}
}
