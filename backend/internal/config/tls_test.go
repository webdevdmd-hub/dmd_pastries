package config

import (
	"strings"
	"testing"
)

func baseDatabaseConfig() Config {
	return Config{
		PostgresHost:     "db.example.test",
		PostgresUser:     "postgres",
		PostgresPassword: "not-a-real-password",
		PostgresDB:       "pastries",
		PostgresPort:     "5432",
		PostgresSSLMode:  "verify-full",
		PostgresTimezone: "UTC",
	}
}

// An unset root certificate must leave the DSN byte-identical to what it was
// before this existed.
//
// libpq does not treat sslrootcert="" as absent -- it reads it as a path to a
// file that is not there and refuses the connection. Emitting it unconditionally
// would break every deployment that never sets it, at boot, with a message
// about a missing file rather than about a setting.
func TestAnUnsetRootCertificateIsNotSentAtAll(t *testing.T) {
	dsn := baseDatabaseConfig().PostgresDSN()

	if strings.Contains(dsn, "sslrootcert") {
		t.Errorf("DSN = %q, want no sslrootcert when none is configured", dsn)
	}
	if !strings.Contains(dsn, "sslmode=verify-full") {
		t.Errorf("DSN = %q, want the sslmode carried through", dsn)
	}
}

func TestARootCertificateIsAppendedWhenSet(t *testing.T) {
	cfg := baseDatabaseConfig()
	cfg.PostgresSSLRootCert = "/etc/ssl/certs/supabase.crt"

	dsn := cfg.PostgresDSN()

	if !strings.Contains(dsn, "sslrootcert=/etc/ssl/certs/supabase.crt") {
		t.Errorf("DSN = %q, want the root certificate path", dsn)
	}
	// The timezone is not a URL parameter and has been lost to a rewrite
	// before; assert the rest of the DSN survived being appended to.
	if !strings.Contains(dsn, "TimeZone=UTC") {
		t.Errorf("DSN = %q, want TimeZone preserved", dsn)
	}
}

func TestSurroundingWhitespaceDoesNotProduceABrokenDSN(t *testing.T) {
	cfg := baseDatabaseConfig()
	cfg.PostgresSSLRootCert = "   "

	if dsn := cfg.PostgresDSN(); strings.Contains(dsn, "sslrootcert") {
		t.Errorf("DSN = %q, want a whitespace-only value treated as unset", dsn)
	}
}

// The warning this is really for.
//
// sslmode=require encrypts and verifies nothing. It silences the existing
// "unencrypted" warning while leaving an active-MITM path to the whole
// database, and it is the value people pick because it sounds like the secure
// one.
func TestEncryptWithoutVerifyIsReportedAsDangerous(t *testing.T) {
	for _, mode := range []string{"require", "REQUIRE", " require ", "prefer", "allow"} {
		cfg := baseDatabaseConfig()
		cfg.PostgresSSLMode = mode

		if !warnsAboutSSLMode(cfg) {
			t.Errorf("sslmode=%q produced no warning; it encrypts but never checks "+
				"the server certificate", mode)
		}
	}
}

func TestVerifyingModesAreNotReported(t *testing.T) {
	for _, mode := range []string{"verify-full", "verify-ca"} {
		cfg := baseDatabaseConfig()
		cfg.PostgresSSLMode = mode

		if warnsAboutSSLMode(cfg) {
			t.Errorf("sslmode=%q was reported as dangerous; it verifies the certificate", mode)
		}
	}
}

// disable was already covered by the plain default check, and must stay covered
// now that the same key has two entries.
func TestDisableIsStillReported(t *testing.T) {
	cfg := baseDatabaseConfig()
	cfg.PostgresSSLMode = "disable"

	if !warnsAboutSSLMode(cfg) {
		t.Error("sslmode=disable produced no warning")
	}
}

// A warning that reports a value nobody set sends the reader looking in the
// wrong place.
func TestTheWarningNamesTheValueThatIsActuallySet(t *testing.T) {
	cfg := baseDatabaseConfig()
	cfg.PostgresSSLMode = "require"

	for _, found := range cfg.DevDefaultsInUse() {
		if found.Key == "POSTGRES_SSLMODE" && found.Value != "require" {
			t.Errorf("reported POSTGRES_SSLMODE = %q, want the configured \"require\"", found.Value)
		}
	}
}

func warnsAboutSSLMode(cfg Config) bool {
	for _, found := range cfg.DevDefaultsInUse() {
		if found.Key == "POSTGRES_SSLMODE" {
			return true
		}
	}
	return false
}
