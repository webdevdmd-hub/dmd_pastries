package expenses

import (
	"os"
	"strings"
	"testing"
)

// postExpenseJournal builds its lines by hand instead of going through
// buildJournalLines, and says so in a comment: "the guards that builder applies
// are applied here instead". One was not. buildJournalLines refuses a header
// account; validateExpenseInput checked account type and allow_manual_posting
// and never IsHeader.
//
// The seeded chart has four headers (50, 60, 62, 63) and the expense picker
// listed 60 first, so recording rent against a header was the path of least
// resistance. The journal balanced, but the trial balance had no row for a
// header and reported a debit/credit mismatch on a correct ledger.
func TestExpenseValidationRejectsHeaderAccounts(t *testing.T) {
	source, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	body := string(source)

	start := strings.Index(body, "func (s *Service) validateExpenseInput(")
	if start == -1 {
		t.Fatal("validateExpenseInput not found")
	}
	end := strings.Index(body[start:], "\nfunc ")
	if end == -1 {
		end = len(body) - start
	}
	fn := body[start : start+end]

	if !strings.Contains(fn, "expenseAccount.IsHeader") {
		t.Fatal("validateExpenseInput does not reject header accounts; posting to one " +
			"produces a journal the trial balance cannot represent")
	}
	// The guard is worthless if it runs after the account has been accepted.
	headerIdx := strings.Index(fn, "expenseAccount.IsHeader")
	manualIdx := strings.Index(fn, "expenseAccount.AllowManualPosting")
	if manualIdx != -1 && headerIdx > manualIdx {
		t.Error("check IsHeader alongside the other account-shape guards, not after them")
	}
	if !strings.Contains(fn, "cannot be posted to") {
		t.Error("the refusal should tell the user what to do instead, matching the wording " +
			"buildJournalLines already uses for the same rule")
	}
}
