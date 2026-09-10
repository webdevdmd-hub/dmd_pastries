package config

import (
	"net/url"
	"strings"
	"testing"
)

// The URL form of the connection, through the whole DSN builder.
//
// The bundled-CA tests next door exercised sslRootCert() directly and passed
// while PostgresDSN() returned DATABASE_URL untouched -- so a deployment
// configured by URL still failed verify-full with the x509 error the
// certificate was shipped to fix. These go through PostgresDSN() itself.

const poolerURL = "postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

func TestADatabaseURLForSupabaseGetsTheBundledCA(t *testing.T) {
	withBundledCA(t, true)

	dsn := Config{DatabaseURL: poolerURL}.PostgresDSN()
	// The path is URL-escaped on the way in, which matters on Windows where the
	// temp path carries a drive letter and backslashes -- and which is exactly
	// what the first version of this assertion forgot.
	if !strings.HasSuffix(dsn, "?sslrootcert="+url.QueryEscape(bundledSupabaseCA)) {
		t.Errorf("DSN = %q, want the bundled CA appended, escaped, as the first query parameter", dsn)
	}
}

func TestTheCAJoinsAnExistingQueryStringWithAnAmpersand(t *testing.T) {
	withBundledCA(t, true)

	dsn := Config{DatabaseURL: poolerURL + "?sslmode=verify-full"}.PostgresDSN()
	if !strings.Contains(dsn, "?sslmode=verify-full&sslrootcert=") {
		t.Errorf("DSN = %q, want sslrootcert joined with & after the existing sslmode", dsn)
	}
	if strings.Count(dsn, "?") != 1 {
		t.Errorf("DSN = %q has more than one ?, which is not a valid URL", dsn)
	}
}

// An operator who wrote sslrootcert themselves meant it.
func TestAnExplicitRootCertInTheURLIsLeftAlone(t *testing.T) {
	withBundledCA(t, true)

	given := poolerURL + "?sslmode=verify-full&sslrootcert=/etc/ssl/certs/mine.crt"
	if dsn := (Config{DatabaseURL: given}).PostgresDSN(); dsn != given {
		t.Errorf("DSN = %q, want the URL untouched", dsn)
	}
}

func TestPostgresSSLRootCertOverridesTheBundledOneInTheURLFormToo(t *testing.T) {
	withBundledCA(t, true)

	dsn := Config{DatabaseURL: poolerURL, PostgresSSLRootCert: "/etc/ssl/certs/operator.crt"}.PostgresDSN()
	if !strings.Contains(dsn, "sslrootcert=%2Fetc%2Fssl%2Fcerts%2Foperator.crt") {
		t.Errorf("DSN = %q, want the operator's certificate, URL-escaped", dsn)
	}
	if strings.Contains(dsn, bundledSupabaseCA) {
		t.Errorf("DSN = %q, the bundled CA must not appear alongside an explicit one", dsn)
	}
}

// Somebody else's database gets nothing added -- byte for byte.
func TestANonSupabaseDatabaseURLIsByteIdentical(t *testing.T) {
	withBundledCA(t, true)

	for _, given := range []string{
		"postgresql://u:p@db.example.test:5432/app",
		"postgresql://u:p@db.example.test:5432/app?sslmode=require",
		"postgresql://u:p@supabase.com.evil.example:5432/app",
	} {
		if dsn := (Config{DatabaseURL: given}).PostgresDSN(); dsn != given {
			t.Errorf("DSN = %q, want %q untouched", dsn, given)
		}
	}
}

func TestNoBundledFileMeansTheURLIsUntouched(t *testing.T) {
	withBundledCA(t, false)

	if dsn := (Config{DatabaseURL: poolerURL}).PostgresDSN(); dsn != poolerURL {
		t.Errorf("DSN = %q, want the URL untouched when the bundled file is missing", dsn)
	}
}
