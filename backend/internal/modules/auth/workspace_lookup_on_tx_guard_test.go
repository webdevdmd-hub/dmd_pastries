package auth

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-005 — auth held a transaction and then read the business
// on the pool, so each request needed two connections; under a page-load burst
// the second one was refused by the pooler and the request died as a 500
// "failed to load workspace" (28 of 61 requests in one reproduction).
// Found by /qa on 2026-09-14
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
//
// Both auth paths open a transaction before they look the workspace up. That
// lookup must ride the same transaction: a pooled read while a transaction is
// open is a second connection per request, which is exactly what starves a
// small pooler when a dashboard fans out twenty calls at once.
func TestAuthPathsReadTheWorkspaceOnTheirOwnTransaction(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	body := string(source)

	for _, fn := range []string{
		"func (s *Service) AuthenticateToken(",
		"func (s *Service) syncProfile(",
	} {
		start := strings.Index(body, fn)
		if start == -1 {
			t.Fatalf("%s not found", fn)
		}
		rest := body[start:]
		if end := strings.Index(rest[len(fn):], "\nfunc "); end != -1 {
			rest = rest[:len(fn)+end]
		}

		begin := strings.Index(rest, ".Begin()")
		if begin == -1 {
			t.Fatalf("%s no longer opens a transaction; update this guard to match", fn)
		}
		inTx := rest[begin:]
		if commit := strings.Index(inTx, ".Commit()"); commit != -1 {
			inTx = inTx[:commit]
		}

		if strings.Contains(inTx, "businessRepo.FindByID(") {
			t.Errorf("%s reads the workspace on the pool while its transaction is open; "+
				"use businessRepo.FindByIDTx(tx, ...) so the request holds one connection, not two", fn)
		}
		if !strings.Contains(inTx, "businessRepo.FindByIDTx(tx,") {
			t.Errorf("%s should load the workspace with businessRepo.FindByIDTx(tx, ...) inside its transaction", fn)
		}
	}
}
