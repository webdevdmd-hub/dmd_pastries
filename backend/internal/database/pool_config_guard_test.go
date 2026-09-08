package database

import (
	"os"
	"strings"
	"testing"
)

// The connection pool has no safe default.
//
// database/sql ships unlimited open connections and two idle ones. Against the
// Postgres that currently shares the Docker bridge with the API, neither number
// is visible: connections are cheap and nothing ever counts them. Against a
// managed Postgres reached over the internet both are load-bearing -- unlimited
// open exhausts the provider's client allowance and starts refusing connections
// instead of queueing, and an idle cap of two makes almost every query pay a
// fresh TCP and TLS handshake.
//
// So this is a guard for a setting whose absence is invisible in development
// and expensive in production, which is exactly the kind that gets deleted in a
// refactor and noticed a month later.
func TestConnectionPoolIsConfigured(t *testing.T) {
	fn := functionSourceIn(t, "postgres.go", "func NewPostgres(")

	for _, setting := range []string{
		"SetMaxOpenConns",
		"SetMaxIdleConns",
		"SetConnMaxLifetime",
		"SetConnMaxIdleTime",
	} {
		if !strings.Contains(fn, setting) {
			t.Errorf("NewPostgres does not call %s; the pool falls back to database/sql's "+
				"defaults, which are unlimited open connections and two idle", setting)
		}
	}

	// Reading them from config is the point: the right numbers differ between a
	// database on the same host and one across the internet, and that has to be
	// changeable without a rebuild.
	if !strings.Contains(fn, "cfg.DBMaxOpenConns") {
		t.Error("pool limits are hardcoded rather than read from config")
	}
}

// PreferSimpleProtocol carries two unrelated guarantees and announces neither.
// It is why NUMERIC arrives as text, which is what money.Amount needs to scan
// an exact decimal, and it is what keeps server-side prepared statements off
// the connection so a transaction-mode pooler stays possible. Turning it off
// reads like a performance win and silently breaks both.
func TestSimpleProtocolStaysOn(t *testing.T) {
	fn := functionSourceIn(t, "postgres.go", "func NewPostgres(")

	if !strings.Contains(fn, "PreferSimpleProtocol: true") {
		t.Error("PreferSimpleProtocol is no longer true: money.Amount will scan NUMERIC as " +
			"a float and lose fils, and transaction-mode connection pooling stops being safe")
	}
}

func functionSourceIn(t *testing.T, file, signature string) string {
	t.Helper()

	source, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read %s: %v", file, err)
	}

	start := strings.Index(string(source), signature)
	if start == -1 {
		t.Fatalf("%s not found in %s", signature, file)
	}

	rest := string(source)[start+len(signature):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}
