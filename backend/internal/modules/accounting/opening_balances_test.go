package accounting

import (
	"strings"
	"testing"
	"time"
)

// Phase 6 / W1. The line builder is the piece that decides which way an
// opening entry faces, and getting it backwards would silently invert a
// balance sheet, so it carries the bulk of the coverage.

func openingLine(t *testing.T, lines []JournalEntryLineRequest, accountID string) JournalEntryLineRequest {
	t.Helper()
	for _, line := range lines {
		if line.AccountID == accountID {
			return line
		}
	}
	t.Fatalf("no line for account %q", accountID)
	return JournalEntryLineRequest{}
}

func TestOpeningLinesDebitDebitNormalAccounts(t *testing.T) {
	// An asset the business already holds: Dr the asset / Cr 3400.
	lines := buildOpeningBalanceLines("asset-1", "equity-3400", "debit", 5000, "Opening balance")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
	if got := openingLine(t, lines, "asset-1").DebitAmount; got != 5000 {
		t.Fatalf("asset should be debited 5000, got %v", got)
	}
	if got := openingLine(t, lines, "equity-3400").CreditAmount; got != 5000 {
		t.Fatalf("3400 should be credited 5000, got %v", got)
	}
}

func TestOpeningLinesCreditCreditNormalAccounts(t *testing.T) {
	// A liability the business already owes: Dr 3400 / Cr the liability.
	lines := buildOpeningBalanceLines("loan-1", "equity-3400", "credit", 20000, "Opening balance")
	if got := openingLine(t, lines, "loan-1").CreditAmount; got != 20000 {
		t.Fatalf("liability should be credited 20000, got %v", got)
	}
	if got := openingLine(t, lines, "equity-3400").DebitAmount; got != 20000 {
		t.Fatalf("3400 should be debited 20000, got %v", got)
	}
}

func TestOpeningLinesMirrorNegativeAmounts(t *testing.T) {
	// A negative asset opening (an overdrawn account) flips the entry and
	// books the magnitude, never a negative amount on a line.
	lines := buildOpeningBalanceLines("asset-1", "equity-3400", "debit", -750.25, "Opening balance")
	asset := openingLine(t, lines, "asset-1")
	if asset.CreditAmount != 750.25 || asset.DebitAmount != 0 {
		t.Fatalf("negative asset opening should credit the asset by its magnitude, got %+v", asset)
	}
	equity := openingLine(t, lines, "equity-3400")
	if equity.DebitAmount != 750.25 {
		t.Fatalf("3400 should be debited 750.25, got %v", equity.DebitAmount)
	}
}

func TestOpeningLinesAlwaysBalance(t *testing.T) {
	for _, testCase := range []struct {
		normalBalance string
		amount        float64
	}{
		{"debit", 1200.55}, {"debit", -1200.55},
		{"credit", 998.01}, {"credit", -998.01},
	} {
		lines := buildOpeningBalanceLines("account", "equity", testCase.normalBalance, testCase.amount, "Opening")
		debits, credits := 0.0, 0.0
		for _, line := range lines {
			debits += line.DebitAmount
			credits += line.CreditAmount
		}
		if debits != credits {
			t.Fatalf("%s %v: debits %v != credits %v", testCase.normalBalance, testCase.amount, debits, credits)
		}
	}
}

// A customer opening is a receivable (debit-normal) and a supplier opening is
// a payable (credit-normal). Swapping them would put every migrated balance
// on the wrong side of the balance sheet.
func TestCounterpartyOpeningDirectionsAreOpposite(t *testing.T) {
	receivable := buildOpeningBalanceLines("ar-1100", "equity-3400", "debit", 1200, "Opening")
	if openingLine(t, receivable, "ar-1100").DebitAmount != 1200 {
		t.Fatal("a customer opening must debit accounts receivable")
	}
	payable := buildOpeningBalanceLines("ap-2000", "equity-3400", "credit", 800, "Opening")
	if openingLine(t, payable, "ap-2000").CreditAmount != 800 {
		t.Fatal("a supplier opening must credit accounts payable")
	}
}

func TestNormalizeOpeningRequiresAParseableDate(t *testing.T) {
	if _, _, err := normalizeOpeningAmountAndDate(100, "not-a-date"); err == nil {
		t.Fatal("an unparseable opening date must be rejected")
	}
	if _, _, err := normalizeOpeningAmountAndDate(100, ""); err == nil {
		t.Fatal("a missing opening date must be rejected")
	}
	amount, date, err := normalizeOpeningAmountAndDate(100.456, "2026-01-01")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if amount != 100.46 {
		t.Fatalf("amount should be rounded to cents, got %v", amount)
	}
	if !date.Equal(time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("date should be truncated to a UTC day, got %s", date)
	}
}

// Every opening balance mechanism credits 3400. Letting two of them cover the
// same account would double the equity side, so the generic editor refuses
// the accounts that already have one.
func TestOpeningEligibilityNamesTheRightScreenForExcludedAccounts(t *testing.T) {
	for code, expected := range map[string]string{
		"1200": "opening stock",
		"1100": "per customer",
		"2000": "per supplier",
		"3400": "balancing account",
	} {
		eligibility, err := (&Service{}).chartAccountOpeningEligibility(nil, "business", &ChartAccount{
			ID: "account", AccountCode: code, Status: "active",
		})
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", code, err)
		}
		if eligibility.Allowed {
			t.Fatalf("%s must not accept a generic opening balance", code)
		}
		if !strings.Contains(eligibility.Reason, expected) {
			t.Fatalf("%s: reason %q should point at %q", code, eligibility.Reason, expected)
		}
	}
}

func TestOpeningEligibilityRejectsInactiveAccounts(t *testing.T) {
	eligibility, err := (&Service{}).chartAccountOpeningEligibility(nil, "business", &ChartAccount{
		ID: "account", AccountCode: "1500", Status: "inactive",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if eligibility.Allowed {
		t.Fatal("an inactive account must not accept an opening balance")
	}
}
