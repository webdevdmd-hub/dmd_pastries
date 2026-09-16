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

// Regression: ISSUE-035, second measurement. The first fix made the lookup
// ignore reversed journals, and on production the next save returned 500:
//
//	duplicate key value violates unique constraint
//	"idx_journal_entries_unique_source_posted"
//
// That index allows one journal per (business, source type, source id) among
// posted AND reversed journals. A replacement keyed (expense, expense id) always
// collides with the journal it replaces, and a reversal keyed to the expense
// could happen once per expense. The accounting module keys a reversal to the
// journal it reverses; expenses now do the same, and key a replacement to the
// journal it replaces.
func TestExpenseJournalsAreKeyedSoEditsNeverCollide(t *testing.T) {
	expenseID := "expense-1"
	first := "journal-1"

	if typ, id := expenseReplacementSource(Expense{ID: expenseID}); typ != "expense" || id != expenseID {
		t.Errorf("an expense with no journal posts its first one as (expense, expense id), got (%s, %s)", typ, id)
	}
	typ, id := expenseReplacementSource(Expense{ID: expenseID, JournalEntryID: &first})
	if typ != "expense_edit" || id != first {
		t.Errorf("a replacement must be keyed to the journal it replaces, got (%s, %s); keying it to the "+
			"expense collides with the index on every edit", typ, id)
	}

	reversal := expenseFunctionBody(t, "service.go", "func (s *Service) postReversalJournal(")
	if !strings.Contains(reversal, "sourceID := *expense.JournalEntryID") {
		t.Error("a reversal must be keyed to the journal it reverses; keyed to the expense, the second edit's " +
			"reversal fails on the unique index")
	}

	update := expenseFunctionBody(t, "service.go", "func (s *Service) Update(")
	if !strings.Contains(update, "expenseReplacementSource(") {
		t.Error("Update must key its replacement journal with expenseReplacementSource")
	}
}

// Delete removes every journal an expense ever had. With reversals and
// replacements keyed to journals, only the first is keyed to the expense, so the
// lookup must follow the chain -- or an edited expense's later journals stay in
// the ledger after it is deleted.
func TestDeleteFindsEveryJournalInTheChain(t *testing.T) {
	body := expenseFunctionBody(t, "repository.go", "func (r *Repository) ListExpenseJournalEntryIDs(")
	if !strings.Contains(body, "for len(frontier) > 0") || !strings.Contains(body, "source_id IN ?") {
		t.Error("ListExpenseJournalEntryIDs must follow source ids outward from the expense; a single lookup " +
			"by expense id misses every journal posted by an edit")
	}
	raw, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	types := string(raw)[strings.Index(string(raw), "var expenseJournalSourceTypes"):]
	for _, want := range []string{"SourceExpense,", "SourceExpenseEdit,", "SourceExpenseUpdateReversal,"} {
		if !strings.Contains(types[:strings.Index(types, "}")], want) {
			t.Errorf("expenseJournalSourceTypes must include %s", want)
		}
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
