package expenses

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-035 — editing a posted expense removed it from the ledger.
//
// Measured on production on 2026-09-16. EXP-20260916-000001 was recorded for
// 25.00 (Cleaning Expense debit, Cash in Hand credit; trial balance showed cash
// 287.00). Editing the amount to 30.00 returned 200 and the list read "Posted,
// AED 30.00" -- but the trial balance went back to cash 312.00 and Cleaning
// Expense 0.00, and the journal list held only:
//
//	JV-20260916-000004  Expense                  Reversed  25.00
//	JV-20260916-000005  Expense Update Reversal  Posted    25.00
//
// No journal for 30.00. Update reversed the original, then asked
// postExpenseJournal for a replacement with the same source; its idempotency
// lookup accepted status "reversed", found the journal just reversed, and
// returned it as the "new" entry. The expense pointed at a dead journal.
//
// It compounds: the next edit would reverse that dead journal again, taking
// another 25.00 out of the ledger on every save.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestExpenseJournalPlan(t *testing.T) {
	for _, tc := range []struct {
		name              string
		accountingChanged bool
		journalLive       bool
		want              journalPlan
	}{
		{"an amount edit on a healthy expense reverses and reposts", true, true, journalPlan{ReverseCurrent: true, PostNew: true}},
		{"a notes-only edit leaves a healthy journal alone", false, true, journalPlan{}},
		{"an expense left pointing at a reversed journal is reposted, not reversed again", false, false, journalPlan{PostNew: true}},
		{"an amount edit on such an expense reposts once and reverses nothing", true, false, journalPlan{PostNew: true}},
	} {
		if got := expenseJournalPlan(tc.accountingChanged, tc.journalLive); got != tc.want {
			t.Errorf("%s: plan = %+v, want %+v", tc.name, got, tc.want)
		}
	}
}

// The measured defect itself: the lookup that makes posting idempotent must
// not treat a reversed journal as the expense's current posting.
func TestPostedJournalLookupIgnoresReversedJournals(t *testing.T) {
	body := expenseFunctionBody(t, "repository.go", "func (r *Repository) FindPostedJournalBySource(")
	if strings.Contains(body, `"reversed"`) {
		t.Error("FindPostedJournalBySource accepts reversed journals, so the replacement posted by an edit " +
			"returns the journal it just reversed and nothing reaches the ledger")
	}
	if !strings.Contains(body, `"posted"`) {
		t.Error("FindPostedJournalBySource must look for a posted journal")
	}
}

func TestExpenseUpdateAndReversalGuardTheLedger(t *testing.T) {
	update := expenseFunctionBody(t, "service.go", "func (s *Service) Update(")
	for _, want := range []string{"JournalIsLive(", "expenseJournalPlan(", "plan.ReverseCurrent", "plan.PostNew"} {
		if !strings.Contains(update, want) {
			t.Errorf("Update must decide its journals with %s; gating on accountingChanged alone reverses a "+
				"journal that may already be reversed", want)
		}
	}

	reversal := expenseFunctionBody(t, "service.go", "func (s *Service) postReversalJournal(")
	live := strings.Index(reversal, "JournalIsLive(")
	create := strings.Index(reversal, "CreateJournalEntry(")
	if live == -1 || create == -1 || live > create {
		t.Error("postReversalJournal must refuse a journal that is not live BEFORE writing a reversal, or a " +
			"second reversal takes the amount out of the ledger twice")
	}
}

func expenseFunctionBody(t *testing.T, file, marker string) string {
	t.Helper()
	raw, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read %s: %v", file, err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, marker)
	if start == -1 {
		t.Fatalf("%s not found in %s", marker, file)
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}
