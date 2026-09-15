package purchasing

import (
	"os"
	"strings"
	"testing"
	"time"
)

// Regression: ISSUE-021 — deactivated and blocked suppliers' posted bills could not be paid.
//
// The supplier status dialogs promise, in their own words:
//
//	Deactivate  "New purchase orders: not allowed.
//	             Receiving and paying what is already open: allowed."
//	Block       "New purchase orders: not allowed. New bills: not allowed.
//	             Paying bills that are already posted: allowed."
//
// Every purchasing action required status = active. Measured on production on
// 2026-09-15: deactivating QA Flour Co and paying its posted bill QAF-INV-1001
// returned 404 "supplier not found" -- for the supplier named on the bill. The
// liability was on the books and could not be settled through the app.
//
// This pins the table to the dialogs. If a dialog changes, change both.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestSupplierStatusAllowsWhatTheDialogsPromise(t *testing.T) {
	for _, tc := range []struct {
		status string
		use    supplierUse
		want   bool
		why    string
	}{
		{"active", supplierUseNewDocument, true, "an active supplier can be ordered from"},
		{"active", supplierUseOpenDocument, true, "an active supplier's orders can be received"},
		{"active", supplierUsePayment, true, "an active supplier's bills can be paid"},

		{"inactive", supplierUseNewDocument, false, `deactivate: "New purchase orders: not allowed"`},
		{"inactive", supplierUseOpenDocument, true, `deactivate: "Receiving ... what is already open: allowed"`},
		{"inactive", supplierUsePayment, true, `deactivate: "paying what is already open: allowed" -- the bug that was measured`},
		{"inactive", supplierUseView, true, `deactivate menu: "History stays"`},

		{"blocked", supplierUseNewDocument, false, `block: "New purchase orders: not allowed. New bills: not allowed"`},
		{"blocked", supplierUseOpenDocument, false, "the block dialog does not allow receiving; a compliance hold is when goods should not be booked in"},
		{"blocked", supplierUsePayment, true, `block: "Paying bills that are already posted: allowed"`},
		{"blocked", supplierUseView, true, "history is never hidden by a status"},

		{"", supplierUsePayment, false, "an unknown status is refused rather than guessed at"},
	} {
		if got := supplierAllows(tc.status, tc.use); got != tc.want {
			t.Errorf("supplierAllows(%q, %s) = %v, want %v: %s", tc.status, tc.use, got, tc.want, tc.why)
		}
	}
}

// Only a payment that settles posted bills is "paying what is already open".
// An advance is new money to the supplier and must not slip through the
// relaxed rule just because it travels through the same endpoint.
func TestSupplierPaymentUseSeparatesSettlementFromAdvances(t *testing.T) {
	bill := func(amount float64) SupplierPaymentAllocationInput {
		return SupplierPaymentAllocationInput{PurchaseInvoiceID: "bill", Amount: amount}
	}
	for _, tc := range []struct {
		name string
		req  CreateSupplierPaymentRequest
		want supplierUse
	}{
		{"paying a posted bill in full", CreateSupplierPaymentRequest{Amount: 540, Allocations: []SupplierPaymentAllocationInput{bill(540)}}, supplierUsePayment},
		{"paying two bills in full", CreateSupplierPaymentRequest{Amount: 540, Allocations: []SupplierPaymentAllocationInput{bill(300), bill(240)}}, supplierUsePayment},
		{"an advance with no bill", CreateSupplierPaymentRequest{Amount: 540}, supplierUseNewDocument},
		{"part bill, part advance", CreateSupplierPaymentRequest{Amount: 540, Allocations: []SupplierPaymentAllocationInput{bill(200)}}, supplierUseNewDocument},
	} {
		if got := supplierPaymentUse(tc.req); got != tc.want {
			t.Errorf("%s: supplierPaymentUse = %s, want %s", tc.name, got, tc.want)
		}
	}
}

// Every purchasing path must name its use. A path that silently fell back to
// "active only" is exactly how paying and receiving were blocked.
func TestPurchasingPathsDeclareTheirSupplierUse(t *testing.T) {
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")

	if strings.Contains(source, ".ValidateSupplier(") {
		t.Error("purchasing calls ValidateSupplier, which filters status = active for every action " +
			"and would re-block paying and receiving for deactivated suppliers")
	}

	for _, fn := range []string{"func (s *Service) buildInvoice(", "func (s *Service) buildReceipt("} {
		body := functionBody(source, fn)
		if !strings.Contains(body, "supplierUseOpenDocument") || !strings.Contains(body, "PurchaseOrderID") {
			t.Errorf("%s must treat a document linked to an existing purchase order as open, so a "+
				"deactivated supplier's order can still be received and billed", fn)
		}
	}
	for _, fn := range []string{"func (s *Service) createSupplierPayment(", "func (s *Service) UpdateSupplierPayment("} {
		if !strings.Contains(functionBody(source, fn), "supplierPaymentUse(req)") {
			t.Errorf("%s must classify the payment with supplierPaymentUse, or a posted bill for an "+
				"inactive or blocked supplier cannot be paid", fn)
		}
	}
}

// Regression: ISSUE-022 — supplier payment terms never set a bill's due date.
//
// The supplier form says payment terms "Sets the due date on bills from this
// supplier." Nothing in purchasing read them: a Net 30 supplier's bill posted as
// "Due Not recorded" on 2026-09-15, so it could never fall overdue.
func TestPaymentTermsSetTheDueDate(t *testing.T) {
	billed := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		terms string
		want  string
	}{
		{"net_7", "2026-09-22"},
		{"net_15", "2026-09-30"},
		{"net_30", "2026-10-15"},
		{"net_45", "2026-10-30"},
		{"net_60", "2026-11-14"},
		{"net_90", "2026-12-14"},
		{"prepaid", "2026-09-15"},
	} {
		due := dueDateFromTerms(billed, tc.terms)
		if due == nil {
			t.Errorf("%s gave no due date", tc.terms)
			continue
		}
		if got := due.Format("2006-01-02"); got != tc.want {
			t.Errorf("%s on %s: due %s, want %s", tc.terms, billed.Format("2006-01-02"), got, tc.want)
		}
	}
	if due := dueDateFromTerms(billed, ""); due != nil {
		t.Errorf("a supplier with no terms must leave the due date empty, got %s", due.Format("2006-01-02"))
	}

	// An explicit due date on the bill must win over the terms.
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	body := functionBody(strings.ReplaceAll(string(raw), "\r\n", "\n"), "func (s *Service) buildInvoice(")
	if !strings.Contains(body, "if dueDate == nil {") {
		t.Error("buildInvoice must only fill the due date from terms when none was given; overwriting " +
			"an explicit due date would silently change what the operator entered")
	}
}

func functionBody(source, marker string) string {
	start := strings.Index(source, marker)
	if start == -1 {
		return ""
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}

// Regression: ISSUE-026 — the inactive-supplier refusal named the wrong action and leaked its code.
//
// Verifying ISSUE-023 on production on 2026-09-15, a 1.00 advance to inactive
// QA Flour Co was correctly refused, with the toast "this supplier is inactive;
// reactivate it before raising new purchase documents: inactive". The operator
// had raised no document, the message did not say their posted bills could
// still be paid, and the status code was appended to the sentence.
func TestSupplierRefusalSaysWhatIsStillAllowed(t *testing.T) {
	for status, must := range map[string][]string{
		"inactive": {"Reactivate", "advance", "posted bills"},
		"blocked":  {"Unblock", "posted bills"},
	} {
		message := supplierRefusalMessage(status)
		for _, word := range must {
			if !strings.Contains(message, word) {
				t.Errorf("%s refusal %q must mention %q: say what the status stops and what it still allows", status, message, word)
			}
		}
		if strings.Contains(message, "purchase documents") {
			t.Errorf("%s refusal %q talks about purchase documents; the refused action may be a payment", status, message)
		}
		if message == "" || strings.ToUpper(message[:1]) != message[:1] {
			t.Errorf("%s refusal %q must be a sentence a person reads", status, message)
		}
	}
}
