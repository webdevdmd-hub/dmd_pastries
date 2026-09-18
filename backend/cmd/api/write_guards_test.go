package main

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-065 — products and POS each passed one write guard that
// any write permission opened. The routes tests in those packages prove each
// route runs its own guard slot; this proves main.go fills each slot with the
// permission the Roles screen promises.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md

// permitsPassedTo returns the permit(...) arguments of one RegisterRoutes call,
// in order.
func permitsPassedTo(t *testing.T, source, call string) []string {
	t.Helper()
	src := strings.ReplaceAll(source, "\r\n", "\n")
	start := strings.Index(src, "\t"+call+"(\n")
	if start < 0 {
		t.Fatalf("%s( not found in main.go", call)
	}
	end := strings.Index(src[start:], "\n\t)\n")
	if end < 0 {
		t.Fatalf("end of %s( not found", call)
	}
	var permits []string
	for line := range strings.SplitSeq(src[start:start+end], "\n") {
		line = strings.TrimSuffix(strings.TrimSpace(line), ",")
		if strings.HasPrefix(line, "permit(") {
			permits = append(permits, line)
		}
	}
	return permits
}

func TestProductAndTillWritesEachNameTheirOwnPermission(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	cases := []struct {
		call string
		want []string
	}{
		{"products.RegisterRoutes", []string{
			`permit("products.view")`,
			`permit("products.create", "products.manage")`,
			`permit("products.edit", "products.manage")`,
			`permit("products.status.update", "products.manage")`,
			`permit("products.delete", "products.manage")`,
		}},
		{"pos.RegisterRoutes", []string{
			`permit("pos.view")`,
			`permit("pos.view", "pos.sell", "pos.checkout")`,
			`permit("pos.sell", "pos.checkout")`,
			`permit("pos.hold_sale")`,
			`permit("pos.resume_sale")`,
			`permit("pos.cancel_held_sale")`,
			`permit("pos.refund")`,
			`permit("pos.void", "pos.refund")`,
		}},
	}
	for _, tc := range cases {
		got := permitsPassedTo(t, string(source), tc.call)
		if len(got) < len(tc.want) {
			t.Fatalf("%s passes %d permits, want at least %d: %v", tc.call, len(got), len(tc.want), got)
		}
		for i, want := range tc.want {
			if got[i] != want {
				t.Errorf("%s guard %d = %s, want %s", tc.call, i+1, got[i], want)
			}
		}
	}
}
