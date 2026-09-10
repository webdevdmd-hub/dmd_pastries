//go:build live

package database

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// Proves, against the real pooler, that the shipped CA verifies its
// certificate -- without needing the database password.
//
// The trick: dial with sslmode=verify-full and a password that is certainly
// wrong. TLS happens before authentication, so if the certificate does not
// verify the error is x509 and the connection never reaches the login step;
// if it does verify, the pooler rejects the password and says so. Either way
// nothing is written, and the second outcome is the one that proves the chain.
//
// Opt-in via `go test -tags live ./internal/database/` because it needs the
// internet and a specific live host, which makes it wrong for the default run.
// Run it when the certificate file changes or a pooler hostname does.
//
// The host and user come from the environment rather than being written here.
// The first version hard-coded a pooler in a region the project was not in --
// guessed from an IPv6 prefix -- and the pooler's answer to that is "tenant
// not found", which this test correctly refuses but which tells you nothing
// about the certificate. Find the region from the dashboard's Connect panel,
// or by probing candidate poolers: the right one rejects a wrong password,
// every other one says the tenant does not exist.
//
//	SUPABASE_POOLER_HOST=aws-0-<region>.pooler.supabase.com \
//	SUPABASE_POOLER_USER=postgres.<ref> \
//	go test -tags live ./internal/database/
func TestBundledCAVerifiesThePoolerCertificate(t *testing.T) {
	host := os.Getenv("SUPABASE_POOLER_HOST")
	user := os.Getenv("SUPABASE_POOLER_USER")
	if host == "" || user == "" {
		t.Skip("set SUPABASE_POOLER_HOST and SUPABASE_POOLER_USER to run against the real pooler")
	}

	ca, err := filepath.Abs(filepath.Join("..", "..", "certs", "supabase-prod-ca-2021.crt"))
	if err != nil {
		t.Fatal(err)
	}

	dsn := "host=" + host + " port=5432 user=" + user + " password=definitely-not-the-password " +
		"dbname=postgres sslmode=verify-full sslrootcert=" + ca

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	conn, err := pgconn.Connect(ctx, dsn)
	if err == nil {
		_ = conn.Close(ctx)
		t.Fatal("connected with a made-up password; that cannot be right")
	}

	message := err.Error()
	if strings.Contains(message, "x509") || strings.Contains(message, "certificate") {
		t.Fatalf("TLS verification failed, so the shipped CA does not match the pooler:\n%s", message)
	}

	// Past TLS, the pooler answers the bad password with SQLSTATE class 28
	// (invalid authorization). That, and only that, proves the handshake
	// succeeded and the certificate was accepted.
	//
	// The first version accepted any Postgres error here, which made the test
	// pass against a pooler in the wrong region: "tenant/user not found" is
	// also a Postgres error (XX000), and it means the host is wrong, not that
	// the certificate is right. A test that cannot tell those apart proves
	// nothing about either.
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		t.Fatalf("failed before the server could answer, which leaves TLS unproven:\n%s", message)
	}
	if !strings.HasPrefix(pgErr.Code, "28") {
		t.Fatalf("the server answered, but not with an authentication failure (SQLSTATE %s) -- "+
			"most likely a pooler that does not host this project:\n%s", pgErr.Code, message)
	}
	t.Logf("TLS verified with the shipped CA; pooler rejected the password as expected: %s", message)
}
