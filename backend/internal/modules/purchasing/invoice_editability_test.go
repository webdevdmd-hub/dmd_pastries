package purchasing

import (
	"os"
	"strings"
	"testing"
)

// QA-BILL-001 was posted, fully received against its purchase order and
// unpaid, and the Bills menu still offered Edit. Opening that form and saving
// it can only ever fail, because a posted bill is editable only while nothing
// has happened to it.
func TestInvoiceEditabilityBlocksATouchedPostedBill(t *testing.T) {
	cases := []struct {
		name          string
		invoice       PurchaseInvoice
		receiveStatus string
		wantEditable  bool
	}{
		{
			name:          "draft is always editable",
			invoice:       PurchaseInvoice{Status: "draft"},
			receiveStatus: "not_received",
			wantEditable:  true,
		},
		{
			name:          "untouched posted bill stays editable",
			invoice:       PurchaseInvoice{Status: "posted"},
			receiveStatus: "not_received",
			wantEditable:  true,
		},
		{
			name:          "received stock blocks editing",
			invoice:       PurchaseInvoice{Status: "posted"},
			receiveStatus: "received",
			wantEditable:  false,
		},
		{
			name:          "partially received stock blocks editing",
			invoice:       PurchaseInvoice{Status: "posted"},
			receiveStatus: "partially_received",
			wantEditable:  false,
		},
		{
			name:          "a payment blocks editing",
			invoice:       PurchaseInvoice{Status: "posted", PaidAmount: 100},
			receiveStatus: "not_received",
			wantEditable:  false,
		},
		{
			name:          "a vendor credit blocks editing",
			invoice:       PurchaseInvoice{Status: "posted", CreditedAmount: 25},
			receiveStatus: "not_received",
			wantEditable:  false,
		},
		{
			name:          "cancelled is never editable",
			invoice:       PurchaseInvoice{Status: "cancelled"},
			receiveStatus: "not_received",
			wantEditable:  false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			editable, reason := invoiceEditability(tc.invoice, tc.receiveStatus)
			if editable != tc.wantEditable {
				t.Fatalf("editable = %v, want %v (reason %q)", editable, tc.wantEditable, reason)
			}
			// A greyed menu item that cannot say why is worse than no gate.
			if !editable && tc.invoice.Status != "draft" && reason == "" {
				t.Error("blocked editing with no reason to show the user")
			}
		})
	}
}

// Regression: ISSUE-027 — Cancel bill was offered on bills the server always refuses to cancel.
//
// On production on 2026-09-15, QAF-INV-1001 was posted and fully paid. Its menu
// greyed Edit with a reason but offered Cancel bill. The dialog took a
// cancellation reason, then the server refused with "purchase invoice has
// completed supplier payments and cannot be cancelled", naming no next step.
func TestInvoiceCancellabilityMatchesCancelInvoice(t *testing.T) {
	cases := []struct {
		name    string
		invoice PurchaseInvoice
		want    bool
	}{
		{"untouched posted bill can be cancelled", PurchaseInvoice{Status: "posted"}, true},
		{"a payment blocks cancelling (the bill measured live)", PurchaseInvoice{Status: "posted", PaidAmount: 540}, false},
		{"a vendor credit blocks cancelling", PurchaseInvoice{Status: "posted", CreditedAmount: 25}, false},
		{"a draft is deleted, not cancelled", PurchaseInvoice{Status: "draft"}, false},
		{"a cancelled bill is not cancelled twice", PurchaseInvoice{Status: "cancelled"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ok, reason := invoiceCancellability(tc.invoice)
			if ok != tc.want {
				t.Fatalf("cancellable = %v, want %v (reason %q)", ok, tc.want, reason)
			}
			if !ok && reason == "" {
				t.Error("blocked cancelling with no reason to show the user")
			}
		})
	}

	// The hint and the refusal must be the same words, or they drift.
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatal(err)
	}
	body := functionBody(strings.ReplaceAll(string(raw), "\r\n", "\n"), "func (s *Service) CancelInvoice(")
	for _, constant := range []string{"cancelBlockedByPayments", "cancelBlockedByVendorCredits"} {
		if !strings.Contains(body, "apperrors.Conflict("+constant) {
			t.Errorf("CancelInvoice must refuse with %s, the text the menu shows as the reason", constant)
		}
	}
	for _, message := range []string{cancelBlockedByPayments, cancelBlockedByVendorCredits} {
		if !strings.Contains(message, "first.") {
			t.Errorf("refusal %q must say what to do first", message)
		}
	}
}
