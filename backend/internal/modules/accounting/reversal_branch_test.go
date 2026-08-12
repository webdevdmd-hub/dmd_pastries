package accounting

import "testing"

// Reversal lines must carry branch_id (audit K5). Migration 000095's composite
// FKs are MATCH SIMPLE, so a NULL branch silently bypasses them and keeps the
// column permanently unvalidatable for the operator hardening step.
func TestBuildReversalLinesCarriesBranch(t *testing.T) {
	entryBranch := "branch-entry"
	lineBranch := "branch-line"
	entry := &JournalEntry{ID: "je-1", BusinessID: "biz-1", BranchID: &entryBranch}
	lines := []JournalEntryLine{
		{ID: "l1", AccountID: "acc-1", BranchID: &lineBranch, DebitAmount: 100.5, CreditAmount: 0, Description: "revenue"},
		{ID: "l2", AccountID: "acc-2", BranchID: nil, DebitAmount: 0, CreditAmount: 100.5, Description: "cash"},
	}

	got := buildReversalLines(entry, lines, "rev-1")

	if len(got) != 2 {
		t.Fatalf("expected 2 reversal lines, got %d", len(got))
	}
	for i, line := range got {
		if line.BranchID == nil {
			t.Fatalf("reversal line %d has nil BranchID", i)
		}
		if line.BusinessID != "biz-1" || line.JournalEntryID != "rev-1" {
			t.Fatalf("reversal line %d has wrong scoping: %+v", i, line)
		}
		if line.LineNumber != i+1 {
			t.Fatalf("reversal line %d has line number %d", i, line.LineNumber)
		}
	}
	// Original line branch wins; nil falls back to the entry's branch.
	if *got[0].BranchID != lineBranch {
		t.Fatalf("line 0 branch = %q, want original line branch %q", *got[0].BranchID, lineBranch)
	}
	if *got[1].BranchID != entryBranch {
		t.Fatalf("line 1 branch = %q, want entry branch fallback %q", *got[1].BranchID, entryBranch)
	}
	// Debit and credit must swap.
	if got[0].DebitAmount != 0 || got[0].CreditAmount != 100.5 {
		t.Fatalf("line 0 amounts not mirrored: %+v", got[0])
	}
	if got[1].DebitAmount != 100.5 || got[1].CreditAmount != 0 {
		t.Fatalf("line 1 amounts not mirrored: %+v", got[1])
	}
}
