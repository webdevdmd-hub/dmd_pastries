package purchasing

import "testing"

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
