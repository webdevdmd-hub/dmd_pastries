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

func TestUnassignedInventoryJournalLinesSQLExcludesStockMovementLinkedJournals(t *testing.T) {
	required := []string{
		"FROM journal_entry_lines jel",
		"JOIN journal_entries je",
		"jel.account_id = ?",
		"je.status IN ('posted', 'reversed')",
		"je.entry_date <= ?",
		"NOT EXISTS",
		"FROM stock_movements sm",
		"sm.accounting_journal_entry_id = jel.journal_entry_id",
	}
	for _, fragment := range required {
		if !strings.Contains(unassignedInventoryJournalLinesSQL, fragment) {
			t.Fatalf("unassigned inventory journal SQL missing %q: %s", fragment, unassignedInventoryJournalLinesSQL)
		}
	}
}

func TestInventoryUnassignedJournalReasonLabels(t *testing.T) {
	cases := []struct {
		sourceType string
		contains   string
	}{
		{sourceType: "manual", contains: "Manual or imported"},
		{sourceType: "purchase_invoice", contains: "Purchase bill journal"},
		{sourceType: "purchase_invoice_cancel", contains: "Purchase bill cancellation"},
		{sourceType: "purchase_return", contains: "Vendor Credit journal"},
		{sourceType: "manufacturing_batch", contains: "Manufacturing journal"},
		{sourceType: "pos_sale_cogs", contains: "POS COGS journal"},
		{sourceType: "unknown_source", contains: "Inventory / Stock journal line"},
	}

	for _, tt := range cases {
		t.Run(tt.sourceType, func(t *testing.T) {
			reason := inventoryUnassignedJournalReason(tt.sourceType)
			if !strings.Contains(reason, tt.contains) {
				t.Fatalf("reason for %q = %q, want to contain %q", tt.sourceType, reason, tt.contains)
			}
		})
	}
}
