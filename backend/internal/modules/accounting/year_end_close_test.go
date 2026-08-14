package accounting

import (
	"testing"
	"time"
)

func TestFinancialYearWindowForCalendarYear(t *testing.T) {
	start, err := financialYearWindowFor(dateUTC(2025, time.December, 31), 1, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !start.Equal(dateUTC(2025, time.January, 1)) {
		t.Fatalf("expected FY start 2025-01-01, got %s", start.Format("2006-01-02"))
	}
}

func TestFinancialYearWindowForAprilStart(t *testing.T) {
	// A business whose financial year starts on 1 April closes on 31 March.
	start, err := financialYearWindowFor(dateUTC(2026, time.March, 31), 4, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !start.Equal(dateUTC(2025, time.April, 1)) {
		t.Fatalf("expected FY start 2025-04-01, got %s", start.Format("2006-01-02"))
	}
}

func TestFinancialYearWindowForRejectsNonBoundaryDate(t *testing.T) {
	if _, err := financialYearWindowFor(dateUTC(2025, time.June, 30), 1, 1); err == nil {
		t.Fatal("expected a mid-year date to be rejected as a financial year end")
	}
}

func TestYearEndCloseSourceIDIsUniquePerBranchAndYear(t *testing.T) {
	first := yearEndCloseSourceID("branch-a", dateUTC(2025, time.December, 31))
	second := yearEndCloseSourceID("branch-b", dateUTC(2025, time.December, 31))
	third := yearEndCloseSourceID("branch-a", dateUTC(2026, time.December, 31))

	if first == second {
		t.Fatal("different branches must not share a close source id")
	}
	if first == third {
		t.Fatal("different financial years must not share a close source id")
	}
	if first != "branch-a-FY2025" {
		t.Fatalf("unexpected source id: %q", first)
	}
}

func TestBuildYearEndCloseLinesMovesProfitToRetainedEarnings(t *testing.T) {
	rows := []ProfitLossAccountRowResponse{
		{AccountID: "income-1", AccountName: "Sales", AccountType: "income", Amount: 10000},
		{AccountID: "cogs-1", AccountName: "COGS", AccountType: "cogs", Amount: 4000},
		{AccountID: "expense-1", AccountName: "Rent", AccountType: "expense", Amount: 2500},
	}
	lines, netProfit := buildYearEndCloseLines(rows, "retained-1")

	if netProfit != 3500 {
		t.Fatalf("expected net profit 3500, got %.2f", netProfit)
	}
	if len(lines) != 4 {
		t.Fatalf("expected 3 account lines + retained earnings, got %d", len(lines))
	}
	if lines[0].AccountID != "income-1" || lines[0].DebitAmount != 10000 {
		t.Fatalf("income must be debited back to zero, got %#v", lines[0])
	}
	if lines[1].AccountID != "cogs-1" || lines[1].CreditAmount != 4000 {
		t.Fatalf("cogs must be credited back to zero, got %#v", lines[1])
	}
	retained := lines[3]
	if retained.AccountID != "retained-1" || retained.CreditAmount != 3500 {
		t.Fatalf("expected retained earnings credited 3500, got %#v", retained)
	}
	assertLinesBalance(t, lines)
}

func TestBuildYearEndCloseLinesDebitsRetainedEarningsOnLoss(t *testing.T) {
	rows := []ProfitLossAccountRowResponse{
		{AccountID: "income-1", AccountName: "Sales", AccountType: "income", Amount: 1000},
		{AccountID: "expense-1", AccountName: "Rent", AccountType: "expense", Amount: 2500},
	}
	lines, netProfit := buildYearEndCloseLines(rows, "retained-1")

	if netProfit != -1500 {
		t.Fatalf("expected a net loss of 1500, got %.2f", netProfit)
	}
	retained := lines[len(lines)-1]
	if retained.AccountID != "retained-1" || retained.DebitAmount != 1500 {
		t.Fatalf("expected retained earnings debited 1500, got %#v", retained)
	}
	assertLinesBalance(t, lines)
}

func TestBuildYearEndCloseLinesSkipsBranchWithoutActivity(t *testing.T) {
	lines, netProfit := buildYearEndCloseLines(nil, "retained-1")
	if lines != nil || netProfit != 0 {
		t.Fatalf("a branch with no activity must produce no close journal, got %#v / %.2f", lines, netProfit)
	}

	// Rows that all round to zero are the same case.
	zeroRows := []ProfitLossAccountRowResponse{
		{AccountID: "income-1", AccountType: "income", Amount: 0},
	}
	if lines, _ := buildYearEndCloseLines(zeroRows, "retained-1"); lines != nil {
		t.Fatalf("zero-amount rows must produce no close journal, got %#v", lines)
	}
}

func TestBuildYearEndCloseLinesHandlesBreakEvenYear(t *testing.T) {
	rows := []ProfitLossAccountRowResponse{
		{AccountID: "income-1", AccountName: "Sales", AccountType: "income", Amount: 5000},
		{AccountID: "expense-1", AccountName: "Rent", AccountType: "expense", Amount: 5000},
	}
	lines, netProfit := buildYearEndCloseLines(rows, "retained-1")
	if netProfit != 0 {
		t.Fatalf("expected break-even, got %.2f", netProfit)
	}
	if len(lines) != 2 {
		t.Fatalf("a break-even close needs no equity leg, got %d lines", len(lines))
	}
	assertLinesBalance(t, lines)
}

func TestBuildYearEndCloseLinesFlipsNegativeBalances(t *testing.T) {
	// A contra balance (e.g. an income account left in debit by returns)
	// must close from the other side.
	rows := []ProfitLossAccountRowResponse{
		{AccountID: "income-1", AccountName: "Sales returns", AccountType: "income", Amount: -800},
		{AccountID: "expense-1", AccountName: "Expense credit", AccountType: "expense", Amount: -200},
	}
	lines, netProfit := buildYearEndCloseLines(rows, "retained-1")
	if lines[0].CreditAmount != 800 {
		t.Fatalf("a negative income balance must be credited, got %#v", lines[0])
	}
	if lines[1].DebitAmount != 200 {
		t.Fatalf("a negative expense balance must be debited, got %#v", lines[1])
	}
	if netProfit != -600 {
		t.Fatalf("expected net -600, got %.2f", netProfit)
	}
	assertLinesBalance(t, lines)
}

func assertLinesBalance(t *testing.T, lines []JournalEntryLineRequest) {
	t.Helper()
	debit, credit := 0.0, 0.0
	for _, line := range lines {
		debit += line.DebitAmount
		credit += line.CreditAmount
	}
	if roundMoney(debit) != roundMoney(credit) {
		t.Fatalf("close journal is unbalanced: Dr %.2f vs Cr %.2f", debit, credit)
	}
}
