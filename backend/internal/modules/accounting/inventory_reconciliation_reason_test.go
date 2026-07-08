package accounting

import "testing"

func TestInventoryReconciliationReasonKeyPendingBillPosting(t *testing.T) {
	row := inventoryReconciliationDetailRow{
		GRNOnlyCount:              2,
		GRNOnlyValue:              125.50,
		OperationalInventoryValue: 125.50,
		AccountingInventoryValue:  0,
	}

	item := inventoryReconciliationDetailFromRow(row)

	if item.PossibleReasonKey != "pending_bill_posting" {
		t.Fatalf("PossibleReasonKey = %q, want pending_bill_posting", item.PossibleReasonKey)
	}
	if item.PendingAccountingCount != 2 {
		t.Fatalf("PendingAccountingCount = %d, want 2", item.PendingAccountingCount)
	}
	if item.PendingAccountingValue != 125.50 {
		t.Fatalf("PendingAccountingValue = %.2f, want 125.50", item.PendingAccountingValue)
	}
	if item.PossibleReason != "Pending Bill Posting: stock is in operational inventory. Accounting inventory updates when the supplier bill is posted." {
		t.Fatalf("PossibleReason = %q", item.PossibleReason)
	}
}
