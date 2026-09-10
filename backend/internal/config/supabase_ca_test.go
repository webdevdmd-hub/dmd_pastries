package config

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The failure this guards was silent on the provider's side: a Supabase pooler
// certificate the system trust store cannot verify, a container that dies
// before Postgres sees it, and nothing in any log the project keeps.

func withBundledCA(t *testing.T, present bool) {
	t.Helper()
	previous := bundledSupabaseCA
	t.Cleanup(func() { bundledSupabaseCA = previous })

	path := filepath.Join(t.TempDir(), "supabase-ca.crt")
	if present {
		if err := os.WriteFile(path, []byte("-- not read, only stat'd --"), 0o600); err != nil {
			t.Fatalf("write fixture: %v", err)
		}
	}
	bundledSupabaseCA = path
}

func supabaseConfig() Config {
	cfg := baseDatabaseConfig()
	cfg.PostgresHost = "aws-0-ap-south-1.pooler.supabase.com"
	return cfg
}

func TestASupabaseHostUsesTheBundledCAWhenTheImageHasIt(t *testing.T) {
	withBundledCA(t, true)

	dsn := supabaseConfig().PostgresDSN()
	if !strings.Contains(dsn, "sslrootcert="+bundledSupabaseCA) {
		t.Errorf("DSN = %q, want the bundled CA applied for a Supabase host", dsn)
	}
}

// No file, no default: verify-full then fails loudly at boot naming the
// certificate, which is the honest outcome. Silently downgrading would be the
// same as sslmode=require, and that is exactly the setting the startup banner
// warns about.
func TestNoBundledCAMeansNoDefault(t *testing.T) {
	withBundledCA(t, false)

	if dsn := supabaseConfig().PostgresDSN(); strings.Contains(dsn, "sslrootcert") {
		t.Errorf("DSN = %q, want no sslrootcert when the bundled file is missing", dsn)
	}
}

// Supabase's authority must never be applied to somebody else's database. It
// would fail verification just as loudly, and the operator would be reading the
// wrong certificate to understand why.
func TestTheBundledCAIsNeverAppliedToANonSupabaseHost(t *testing.T) {
	withBundledCA(t, true)

	for _, host := range []string{
		"db.example.test",
		"dmdpastries-internal-alias",
		"supabase.com.evil.example", // suffix match must be on the real domain, not a lookalike
		"notsupabase.co.example",
	} {
		cfg := baseDatabaseConfig()
		cfg.PostgresHost = host
		if dsn := cfg.PostgresDSN(); strings.Contains(dsn, "sslrootcert") {
			t.Errorf("host %q: DSN = %q, the bundled CA was applied outside Supabase", host, dsn)
		}
	}
}

func TestAnExplicitRootCertificateWinsOverTheBundledOne(t *testing.T) {
	withBundledCA(t, true)

	cfg := supabaseConfig()
	cfg.PostgresSSLRootCert = "/etc/ssl/certs/operator-supplied.crt"

	dsn := cfg.PostgresDSN()
	if !strings.Contains(dsn, "sslrootcert=/etc/ssl/certs/operator-supplied.crt") {
		t.Errorf("DSN = %q, want the operator's certificate", dsn)
	}
	if strings.Contains(dsn, bundledSupabaseCA) {
		t.Errorf("DSN = %q, the bundled CA must not appear alongside an explicit one", dsn)
	}
}

// DATABASE_URL replaces the whole DSN, so the host that matters is the one
// inside it, not POSTGRES_HOST.
func TestTheHostInsideDatabaseURLDecides(t *testing.T) {
	withBundledCA(t, true)

	cfg := Config{DatabaseURL: "postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"}
	if cfg.sslRootCert() != bundledSupabaseCA {
		t.Error("a Supabase host inside DATABASE_URL did not select the bundled CA")
	}

	cfg = Config{DatabaseURL: "postgresql://u:p@db.example.test:5432/app", PostgresHost: "aws-0-ap-south-1.pooler.supabase.com"}
	if cfg.sslRootCert() != "" {
		t.Error("POSTGRES_HOST was consulted even though DATABASE_URL overrides it")
	}
}

// The file shipped in the image is the real thing, pinned by fingerprint. A
// swapped or truncated certificate would otherwise fail only at boot, on the
// production host, with the same message as having none.
func TestTheShippedCertificateIsSupabaseRoot2021(t *testing.T) {
	const (
		wantSubject     = "CN=Supabase Root 2021 CA"
		wantFingerprint = "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa"
	)

	raw, err := os.ReadFile(filepath.Join("..", "..", "certs", "supabase-prod-ca-2021.crt"))
	if err != nil {
		t.Fatalf("the certificate the Dockerfile copies is missing: %v", err)
	}

	block, _ := pem.Decode(raw)
	if block == nil || block.Type != "CERTIFICATE" {
		t.Fatal("certs/supabase-prod-ca-2021.crt is not a PEM certificate")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	if !strings.Contains(cert.Subject.String(), wantSubject) {
		t.Errorf("subject = %q, want it to contain %q", cert.Subject.String(), wantSubject)
	}
	if !cert.IsCA {
		t.Error("the shipped certificate is not a CA certificate")
	}
	sum := sha256.Sum256(cert.Raw)
	if got := hex.EncodeToString(sum[:]); got != wantFingerprint {
		t.Errorf("sha256 fingerprint = %s, want %s -- the shipped file is not the certificate "+
			"that was verified against the pooler on 2026-09-10", got, wantFingerprint)
	}
}
