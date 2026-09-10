//go:build live

package database

import (
	"context"
	"errors"
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
func TestBundledCAVerifiesThePoolerCertificate(t *testing.T) {
	ca, err := filepath.Abs(filepath.Join("..", "..", "certs", "supabase-prod-ca-2021.crt"))
	if err != nil {
		t.Fatal(err)
	}

	dsn := "host=aws-0-ap-south-1.pooler.supabase.com port=5432 " +
		"user=postgres.zpyoxptzcbzsbtkhddwb password=definitely-not-the-password " +
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

	// Past TLS, the pooler answers the bad password. Any of these shapes means
	// the handshake succeeded and the certificate was accepted.
	var pgErr *pgconn.PgError
	authFailure := errors.As(err, &pgErr) ||
		strings.Contains(message, "password") ||
		strings.Contains(message, "SASL") ||
		strings.Contains(message, "auth")
	if !authFailure {
		t.Fatalf("failed for a reason other than authentication, which leaves TLS unproven:\n%s", message)
	}
	t.Logf("TLS verified with the shipped CA; pooler rejected the password as expected: %s", message)
}
