package accounting

import (
	"os"
	"strings"
	"testing"
)

// Measured on production on 2026-09-17 with manual journal JV-20260917-000001
// (Dr 6110 Office Expense 10.00 / Cr 1000 Cash in Hand 10.00), posted:
//
//	Reverse -> 400 "invalid request payload" (EOF)                       ISSUE-047
//	Delete  -> 400 "system-generated journal entries must be deleted
//	           from the source document"                                 ISSUE-048
//
// A manual journal could be neither reversed nor deleted. And on the
// Accounting Reconciliation page, a correct ledger showed:
//
//	Accounts Receivable  operational 1,617.00  ledger 1,316.00           ISSUE-049
//	Accounts Payable     operational     0.00  ledger  -270.00           ISSUE-050
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md

func readAccountingFile(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}

func TestReverseAcceptsARequestWithoutABody(t *testing.T) {
	body := functionSource(readAccountingFile(t, "handler.go"), "func (h *Handler) ReverseJournalEntry(")
	if !strings.Contains(body, "c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF)") {
		t.Error("ReverseJournalEntry must accept an empty body: every field is optional and the journal page " +
			"sends none, so binding failed with EOF and no journal could be reversed")
	}
}

func TestManualJournalSource(t *testing.T) {
	for source, want := range map[string]bool{
		"manual":           true, // what the journal page saves: the measured case
		"":                 true, // older manual journals
		" manual ":         true,
		"pos_sale":         false,
		"journal_reversal": false,
		"supplier_payment": false,
	} {
		if got := isManualJournalSource(source); got != want {
			t.Errorf("isManualJournalSource(%q) = %v, want %v", source, got, want)
		}
	}
}

func TestOnlyManualDraftsCanBeDeleted(t *testing.T) {
	body := functionSource(readAccountingFile(t, "service.go"), "func (s *Service) DeleteJournalEntry(")
	manual := strings.Index(body, "if !isManualJournalSource(entry.SourceType) {")
	draft := strings.Index(body, `if entry.Status != "draft" {`)
	remove := strings.Index(body, "SoftDeleteJournalEntry(")
	if manual == -1 {
		t.Error(`DeleteJournalEntry must treat source_type "manual" as manual, or every manual journal is refused as system-generated`)
	}
	if draft == -1 || remove == -1 || draft > remove {
		t.Error("DeleteJournalEntry must refuse posted journals before deleting (owner decision: drafts only; " +
			"a posted journal is corrected by reversing)")
	}
}

func TestSystemJournalsAreNotReversedByHand(t *testing.T) {
	body := functionSource(readAccountingFile(t, "service.go"), "func (s *Service) ReverseJournalEntry(")
	guard := strings.Index(body, "if !isManualJournalSource(entry.SourceType) {")
	create := strings.Index(body, "CreateJournalEntry(tx, reversal")
	if guard == -1 || create == -1 || guard > create {
		t.Error("ReverseJournalEntry must refuse system journals: their sale, bill or payment would still " +
			"claim a journal the ledger has cancelled")
	}
}

func TestReceivablesReconciliationCountsOnlyCompletedOrders(t *testing.T) {
	body := functionSource(readAccountingFile(t, "repository.go"), "func (r *Repository) SumAccountsReceivableOperational(")
	if !strings.Contains(body, `reportshared.BakeryOrderCompletedCondition("")`) {
		t.Error("the AR reconciliation must count only completed bakery orders: an open order has debited " +
			"nothing to 1100 (measured: ORD-000005's unpaid 301.00 showed as drift)")
	}
}

func TestPayablesReconciliationOffsetsOpenVendorCredits(t *testing.T) {
	// The measured case: no open bills, VC-000001 left 270.00 unapplied, and the
	// ledger reads -270.00.
	if got := accountsPayableOperational(0, 0, 270); got != -270 {
		t.Errorf("accountsPayableOperational(0, 0, 270) = %v, want -270 to match the ledger", got)
	}
	if got := accountsPayableOperational(540, 100, 270); got != 370 {
		t.Errorf("accountsPayableOperational(540, 100, 270) = %v, want 370", got)
	}
	body := functionSource(readAccountingFile(t, "service.go"), "func (s *Service) GetAPReconciliation(")
	if !strings.Contains(body, "s.repo.SumOpenVendorCredits(") ||
		!strings.Contains(body, "accountsPayableOperational(operational, supplierOpenings, openVendorCredits)") {
		t.Error("the AP reconciliation must subtract open vendor credits from the operational side")
	}
	repo := functionSource(readAccountingFile(t, "repository.go"), "func (r *Repository) SumOpenVendorCredits(")
	if !strings.Contains(repo, "status = 'posted'") || !strings.Contains(repo, "open_credit_amount") {
		t.Error("SumOpenVendorCredits must total open_credit_amount of posted vendor credits only")
	}
}

// Regression: ISSUE-051 — a supplier payment journal was referenced by a raw id.
func TestSupplierPaymentJournalReference(t *testing.T) {
	if got := supplierPaymentJournalReference("", "QA Flour Co"); got != "QA Flour Co" {
		t.Errorf("reference = %q, want the supplier name when the payment has no reference", got)
	}
	if got := supplierPaymentJournalReference("CHQ-1044", "QA Flour Co"); got != "CHQ-1044" {
		t.Errorf("reference = %q, want the payment's own reference", got)
	}
	service := readAccountingFile(t, "service.go")
	if strings.Contains(service, "reference = payment.ID") {
		t.Error("the supplier payment journal falls back to the payment id again")
	}
	migration := readAccountingFile(t, "../../../migrations/000116_supplier_payment_journal_reference.sql")
	for _, want := range []string{"je.source_type = 'supplier_payment'", "je.reference_number = sp.id::text", "SET reference_number = s.supplier_name"} {
		if !strings.Contains(migration, want) {
			t.Errorf("migration 000116 must rename existing id references; missing %q", want)
		}
	}
}
