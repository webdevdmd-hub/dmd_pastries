package accounting

import (
	"strings"
	"testing"

	"pastries-pos/internal/shared/utils"
)

func TestPostPurchaseReceiptJournalIsNoOpForBillOnlyPolicy(t *testing.T) {
	service := &Service{}
	journalID, err := service.PostPurchaseReceiptJournal(nil, &utils.AuthContext{}, "receipt-id")
	if err != nil {
		t.Fatalf("PostPurchaseReceiptJournal returned error: %v", err)
	}
	if journalID != "" {
		t.Fatalf("PostPurchaseReceiptJournal returned journal ID %q, want empty", journalID)
	}
}

func TestBackfillTargetsExcludePurchaseReceipts(t *testing.T) {
	for _, target := range defaultBackfillTargets() {
		if target == "purchase_receipts" {
			t.Fatal("purchase_receipts must not be a default accounting backfill target under bill-only purchasing accounting")
		}
	}
	if validBackfillTarget("purchase_receipts") {
		t.Fatal("purchase_receipts must not be accepted as an accounting backfill target")
	}
}

func TestStockMovementBackfillExcludesPurchaseIn(t *testing.T) {
	_, _, _, _, _, _, _, _, _, extraCondition := backfillTargetQuery("stock_movements")
	if extraCondition == "" {
		t.Fatal("stock_movements backfill should have a movement_type filter")
	}
	if containsSQLToken(extraCondition, "purchase_in") {
		t.Fatalf("stock_movements backfill condition %q must not include purchase_in", extraCondition)
	}
}

func TestPurchaseInvoiceBackfillStillEnabled(t *testing.T) {
	table, _, _, _, _, _, statusColumn, statusValue, missingCondition, _ := backfillTargetQuery("purchase_invoices")
	if table != "purchase_invoices" {
		t.Fatalf("purchase invoice backfill table = %q, want purchase_invoices", table)
	}
	if statusColumn != "status" || statusValue != "posted" {
		t.Fatalf("purchase invoice backfill status = %q/%q, want status/posted", statusColumn, statusValue)
	}
	if missingCondition != "journal_entry_id IS NULL" {
		t.Fatalf("purchase invoice missing condition = %q, want journal_entry_id IS NULL", missingCondition)
	}
}

func TestPaymentRefundBackfillTargetsPOSRefundsOnly(t *testing.T) {
	table, _, _, _, _, dateColumn, statusColumn, statusValue, missingCondition, extraCondition := backfillTargetQuery("payment_refunds")
	if table != "payment_refunds" {
		t.Fatalf("payment refund backfill table = %q, want payment_refunds", table)
	}
	if dateColumn != "refunded_at" || statusColumn != "refund_status" || statusValue != "completed" {
		t.Fatalf("payment refund backfill status/date = %q/%q/%q", dateColumn, statusColumn, statusValue)
	}
	if !strings.Contains(missingCondition, "journal_entry_id IS NULL") || !strings.Contains(missingCondition, "pos_sale_refund") {
		t.Fatalf("payment refund missing condition should find unlinked pos_sale_refund journals, got %q", missingCondition)
	}
	if !strings.Contains(extraCondition, "'pos_sale'") || !strings.Contains(extraCondition, "'payment_adjustment'") || strings.Contains(extraCondition, "'sales_return'") {
		t.Fatalf("payment refund extra condition should include only POS/payment adjustment refunds, got %q", extraCondition)
	}
	if !validBackfillTarget("payment_refunds") {
		t.Fatal("payment_refunds must be an accepted accounting backfill target")
	}
}

func containsSQLToken(value, token string) bool {
	for i := 0; i+len(token) <= len(value); i++ {
		if value[i:i+len(token)] == token {
			return true
		}
	}
	return false
}
