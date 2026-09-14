package businesses

import (
	"strings"
	"testing"
)

// Regression: T-AF — TestGenericBusinessUpdateCannotChangeStatus failed on a
// violation that did not exist.
//
// functionSourceIn terminated on "\nfunc " or, failing that, "\n}\n". This
// repository checks out CRLF. "\nfunc " survives that ("\r\nfunc " ends in \n)
// but "\n}\n" cannot, because the byte after "}" is "\r". dto.go declares no
// funcs, so both terminators missed and the helper returned every remaining
// byte of the file. The guard then matched "Status" in a struct far below
// UpdateBusinessRequest and reported a workspace-closing hole that was never
// open.
//
// Found by /qa on 2026-09-14 while clearing the last red test on main.
// Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
//
// These cases run the helper against literal CRLF input, so they fail on any
// machine regardless of how git materialised the working tree.
func TestFunctionSourceInStopsAtTheDeclarationBoundary(t *testing.T) {
	const crlfStructs = "package p\r\n" +
		"\r\n" +
		"type Wanted struct {\r\n" +
		"\tName string\r\n" +
		"}\r\n" +
		"\r\n" +
		"type Unwanted struct {\r\n" +
		"\tStatus string\r\n" +
		"}\r\n"

	got := functionSourceIn(crlfStructs, "type Wanted struct {")
	if got == "" {
		t.Fatal("helper found nothing; it can no longer locate a struct")
	}
	if strings.Contains(got, "Status") {
		t.Errorf("helper ran past Wanted into the next declaration: %q", got)
	}
	if !strings.Contains(got, "Name") {
		t.Errorf("helper stopped too early and lost the struct's own body: %q", got)
	}
}

// A file whose only declaration is the one being read has no following
// declaration to stop at, so the closing brace is the only boundary available.
// That is the exact shape of dto.go's last struct, and the shape the old
// fallback could not handle on CRLF.
func TestFunctionSourceInStopsAtClosingBraceWithNoFollowingDeclaration(t *testing.T) {
	const crlfOnly = "package p\r\n" +
		"\r\n" +
		"type Lonely struct {\r\n" +
		"\tName string\r\n" +
		"}\r\n" +
		"\r\n" +
		"// Status appears only in this trailing comment.\r\n"

	got := functionSourceIn(crlfOnly, "type Lonely struct {")
	if strings.Contains(got, "Status") {
		t.Errorf("helper ran past the closing brace into trailing content: %q", got)
	}
	if !strings.Contains(got, "Name") {
		t.Errorf("helper lost the struct's own body: %q", got)
	}
}

// The helper must behave identically on LF, or a fix for Windows checkouts
// would quietly change what the guards read on Linux and in CI.
func TestFunctionSourceInBehavesTheSameOnLF(t *testing.T) {
	const lf = "package p\n\ntype Wanted struct {\n\tName string\n}\n\ntype Unwanted struct {\n\tStatus string\n}\n"

	got := functionSourceIn(lf, "type Wanted struct {")
	if strings.Contains(got, "Status") {
		t.Errorf("helper ran past Wanted on LF input: %q", got)
	}
	if !strings.Contains(got, "Name") {
		t.Errorf("helper lost the struct's own body on LF input: %q", got)
	}
}

// The guard this helper serves must still be able to fail. If someone adds
// Status back to UpdateBusinessRequest, the bounded capture has to catch it --
// otherwise the fix above would have turned a false red into a false green,
// which is the worse of the two mistakes.
func TestBoundedCaptureStillCatchesAReintroducedStatusField(t *testing.T) {
	const reintroduced = "package p\r\n" +
		"\r\n" +
		"type UpdateBusinessRequest struct {\r\n" +
		"\tBusinessName string `json:\"business_name\"`\r\n" +
		"\tStatus       string `json:\"status\"`\r\n" +
		"}\r\n" +
		"\r\n" +
		"type Other struct {\r\n" +
		"\tName string\r\n" +
		"}\r\n"

	got := functionSourceIn(reintroduced, "type UpdateBusinessRequest struct {")
	if !strings.Contains(got, "Status") {
		t.Error("a Status field inside UpdateBusinessRequest was not captured; the guard " +
			"would pass while any settings manager could close the workspace")
	}
}
