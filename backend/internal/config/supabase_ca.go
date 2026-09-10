package config

import (
	"net/url"
	"os"
	"strings"
)

// bundledSupabaseCA is where the Dockerfile puts Supabase's root certificate.
//
// The pooler's certificate is issued by Supabase's own authority, not by a
// public one, so the system trust store cannot verify it and
// sslmode=verify-full fails with "certificate signed by unknown authority".
// That failure happens before Postgres sees a connection, so nothing appears
// in the project's logs -- which made it look like the deploy had never run.
//
// A package variable rather than a constant so tests can point it at a file
// that does or does not exist without touching the real path.
var bundledSupabaseCA = "/app/certs/supabase-prod-ca-2021.crt"

// sslRootCert is the CA file the database connection should verify against,
// or "" to leave the driver on the system trust store.
//
// An explicit POSTGRES_SSLROOTCERT always wins. Otherwise, for a Supabase host
// and only for one, the bundled certificate is used if the image has it. The
// automatic default exists because this was the one setting in the cutover
// that could not be discovered from the environment page: every other value
// is either right or visibly wrong, but a missing root certificate is a
// silent boot failure with no trace on the provider's side.
//
// It is never applied to a non-Supabase host. Verifying some other database
// against Supabase's authority would fail just as loudly, and the operator
// would be looking at the wrong certificate to understand why.
func (c Config) sslRootCert() string {
	if root := strings.TrimSpace(c.PostgresSSLRootCert); root != "" {
		return root
	}
	if !isSupabaseHost(c.effectiveDatabaseHost()) {
		return ""
	}
	if _, err := os.Stat(bundledSupabaseCA); err != nil {
		return ""
	}
	return bundledSupabaseCA
}

// effectiveDatabaseHost is the host the driver will actually dial: from
// DATABASE_URL when that is set, since it replaces the whole DSN, else
// POSTGRES_HOST.
func (c Config) effectiveDatabaseHost() string {
	if raw := strings.TrimSpace(c.DatabaseURL); raw != "" {
		if parsed, err := url.Parse(raw); err == nil {
			return parsed.Hostname()
		}
		return ""
	}
	return strings.TrimSpace(c.PostgresHost)
}

func isSupabaseHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	return strings.HasSuffix(host, ".supabase.com") || strings.HasSuffix(host, ".supabase.co")
}
