package purchasing

import "testing"

func TestReceiptAccountingStateFromInvoice(t *testing.T) {
	journalID := "journal-id"
	cases := []struct {
		name    string
		receipt PurchaseReceipt
		invoice *receiptAccountingInvoiceRow
		want    string
	}{
		{
			name:    "draft receipt is not applicable",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "draft"},
			want:    "not_applicable",
		},
		{
			name:    "cancelled receipt is not applicable",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "cancelled"},
			want:    "not_applicable",
		},
		{
			name:    "posted receipt without bill is pending bill posting",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "posted"},
			want:    "pending_bill_posting",
		},
		{
			name:    "posted receipt linked to draft bill is pending bill posting",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "posted"},
			invoice: &receiptAccountingInvoiceRow{ID: "invoice-id", Status: "draft"},
			want:    "pending_bill_posting",
		},
		{
			name:    "posted receipt linked to posted bill without journal is pending accounting journal",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "posted"},
			invoice: &receiptAccountingInvoiceRow{ID: "invoice-id", Status: "posted"},
			want:    "pending_accounting_journal",
		},
		{
			name:    "posted receipt linked to posted bill with journal is accounted",
			receipt: PurchaseReceipt{ID: "receipt-id", Status: "posted"},
			invoice: &receiptAccountingInvoiceRow{ID: "invoice-id", Status: "posted", JournalEntryID: &journalID},
			want:    "accounted_at_bill_posting",
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := receiptAccountingStateFromInvoice(tt.receipt, tt.invoice)
			if got.Status != tt.want {
				t.Fatalf("Status = %q, want %q", got.Status, tt.want)
			}
			if tt.want == "pending_bill_posting" && got.Label != "Pending Bill Posting" {
				t.Fatalf("Label = %q, want Pending Bill Posting", got.Label)
			}
		})
	}
}

func TestPreferredReceiptAccountingInvoice(t *testing.T) {
	journalID := "journal-id"
	orderID := "order-id"
	invoices := []receiptAccountingInvoiceRow{
		{ID: "draft-invoice", PurchaseOrderID: &orderID, Status: "draft"},
		{ID: "posted-without-journal", PurchaseOrderID: &orderID, Status: "posted"},
		{ID: "posted-with-journal", PurchaseOrderID: &orderID, Status: "posted", JournalEntryID: &journalID},
	}

	got := preferredReceiptAccountingInvoice(invoices)

	if got == nil || got.ID != "posted-with-journal" {
		t.Fatalf("preferred invoice = %#v, want posted-with-journal", got)
	}
}
