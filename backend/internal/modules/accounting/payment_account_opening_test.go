package accounting

import (
	"testing"
	"time"
)

func TestNormalizeOpeningBalanceInputIgnoresUntouchedFields(t *testing.T) {
	resolved, err := normalizeOpeningBalanceInput("bank", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != nil {
		t.Fatalf("expected nil when neither field is supplied, got %#v", resolved)
	}
}

func TestNormalizeOpeningBalanceInputRequiresDateForNonZeroAmount(t *testing.T) {
	amount := 5000.0
	if _, err := normalizeOpeningBalanceInput("bank", &amount, nil); err == nil {
		t.Fatal("expected an error when an amount is set without a date")
	}

	zero := 0.0
	resolved, err := normalizeOpeningBalanceInput("bank", &zero, nil)
	if err != nil {
		t.Fatalf("a zero amount needs no date: %v", err)
	}
	if resolved == nil || resolved.Amount != 0 {
		t.Fatalf("expected a zero-amount input, got %#v", resolved)
	}
}

func TestNormalizeOpeningBalanceInputRejectsStoreCredit(t *testing.T) {
	amount := 100.0
	date := "2026-01-01"
	if _, err := normalizeOpeningBalanceInput("store_credit", &amount, &date); err == nil {
		t.Fatal("store credit accounts must not accept an opening balance")
	}
	// Zero is still fine: it is what every store-credit account already has.
	zero := 0.0
	if _, err := normalizeOpeningBalanceInput("store_credit", &zero, nil); err != nil {
		t.Fatalf("a zero opening balance on store credit must be allowed: %v", err)
	}
}

func TestNormalizeOpeningBalanceInputTruncatesDate(t *testing.T) {
	amount := 1200.0
	date := "2026-01-01"
	resolved, err := normalizeOpeningBalanceInput("cash", &amount, &date)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved.Date == nil || !resolved.Date.Equal(time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected the date truncated to 2026-01-01 UTC, got %v", resolved.Date)
	}
}

func TestBuildPaymentAccountOpeningLinesDebitsAssetWhenPositive(t *testing.T) {
	lines := buildPaymentAccountOpeningLines("chart-1", "equity-1", 5000, "Emirates NBD")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
	if lines[0].AccountID != "chart-1" || lines[0].DebitAmount != 5000 || lines[0].CreditAmount != 0 {
		t.Fatalf("expected the asset debited 5000, got %#v", lines[0])
	}
	if lines[1].AccountID != "equity-1" || lines[1].CreditAmount != 5000 || lines[1].DebitAmount != 0 {
		t.Fatalf("expected opening equity credited 5000, got %#v", lines[1])
	}
}

func TestBuildPaymentAccountOpeningLinesMirrorsWhenNegative(t *testing.T) {
	lines := buildPaymentAccountOpeningLines("chart-1", "equity-1", -750.25, "Overdrawn account")
	if lines[0].AccountID != "equity-1" || lines[0].DebitAmount != 750.25 {
		t.Fatalf("expected opening equity debited 750.25, got %#v", lines[0])
	}
	if lines[1].AccountID != "chart-1" || lines[1].CreditAmount != 750.25 {
		t.Fatalf("expected the asset credited 750.25, got %#v", lines[1])
	}
}

func TestBuildPaymentAccountOpeningLinesBalance(t *testing.T) {
	for _, amount := range []float64{5000, -5000, 0.05} {
		lines := buildPaymentAccountOpeningLines("chart-1", "equity-1", amount, "Account")
		debit, credit := 0.0, 0.0
		for _, line := range lines {
			debit += line.DebitAmount
			credit += line.CreditAmount
		}
		if roundMoney(debit) != roundMoney(credit) {
			t.Fatalf("opening lines for %.2f are unbalanced: Dr %.2f vs Cr %.2f", amount, debit, credit)
		}
	}
}

func TestSameOptionalDate(t *testing.T) {
	first := time.Date(2026, time.January, 1, 9, 30, 0, 0, time.UTC)
	second := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	third := time.Date(2026, time.January, 2, 0, 0, 0, 0, time.UTC)

	if !sameOptionalDate(nil, nil) {
		t.Fatal("two nil dates are the same")
	}
	if sameOptionalDate(&first, nil) {
		t.Fatal("a set date differs from nil")
	}
	if !sameOptionalDate(&first, &second) {
		t.Fatal("same calendar day must compare equal regardless of time")
	}
	if sameOptionalDate(&second, &third) {
		t.Fatal("different calendar days must compare unequal")
	}
}
