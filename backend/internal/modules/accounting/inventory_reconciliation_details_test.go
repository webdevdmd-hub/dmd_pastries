package accounting

import (
	"strings"
	"testing"
)

func TestInventoryReconciliationDetailFromRowMatched(t *testing.T) {
	item := inventoryReconciliationDetailFromRow(inventoryReconciliationDetailRow{
		InventoryItemID:           "item-1",
		ItemName:                  "Flour",
		OperationalInventoryValue: 25,
		InventoryLedgerValue:      25,
		AccountingInventoryValue:  25,
		OperationalQuantity:       5,
	})

	if item.Status != "matched" {
		t.Fatalf("expected matched status, got %q", item.Status)
	}
	if item.DifferenceAmount != 0 {
		t.Fatalf("expected zero difference, got %.2f", item.DifferenceAmount)
	}
}

func TestInventoryReconciliationDetailFromRowVendorCreditMissingJournal(t *testing.T) {
	item := inventoryReconciliationDetailFromRow(inventoryReconciliationDetailRow{
		InventoryItemID:            "item-1",
		ItemName:                   "Flour",
		OperationalInventoryValue:  25,
		InventoryLedgerValue:       25,
		AccountingInventoryValue:   30,
		PurchaseReturnMissingCount: 1,
		LastTransactionType:        "purchase_return_out",
		LastTransactionReference:   "VC-000001",
	})

	if item.Status != "mismatch" {
		t.Fatalf("expected mismatch status, got %q", item.Status)
	}
	if item.DifferenceAmount != -5 {
		t.Fatalf("expected signed AED -5.00 difference, got %.2f", item.DifferenceAmount)
	}
	if !strings.Contains(item.PossibleReason, "Vendor Credit") {
		t.Fatalf("expected Vendor Credit reason, got %q", item.PossibleReason)
	}
}

func TestInventoryReconciliationDetailFromRowPOSCOGSMissingLink(t *testing.T) {
	item := inventoryReconciliationDetailFromRow(inventoryReconciliationDetailRow{
		InventoryItemID:           "item-1",
		ItemName:                  "Cake",
		OperationalInventoryValue: 10,
		InventoryLedgerValue:      10,
		AccountingInventoryValue:  0,
		POSCOGSMissingCount:       1,
		LastTransactionType:       "sale_out",
		LastTransactionReference:  "SALE-000001",
	})

	if item.Status != "mismatch" {
		t.Fatalf("expected mismatch status, got %q", item.Status)
	}
	if !strings.Contains(item.PossibleReason, "COGS") {
		t.Fatalf("expected COGS reason, got %q", item.PossibleReason)
	}
}
