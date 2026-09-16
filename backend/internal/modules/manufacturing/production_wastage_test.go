package manufacturing

import (
	"os"
	"strings"
	"testing"

	"pastries-pos/internal/shared/money"
)

// Regression: ISSUE-042 — finished goods entered stock at a unit cost rounded to cents.
//
// completeBatchTx divided what production consumed by the quantity made and
// rounded to cents before valuing the output. The batch journal debits Work in
// Process with the consumption and credits it with the output, so every
// rounding difference stayed in 1210 for good, and a small unit cost lost the
// batch's value outright.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestFinishedGoodsEnterStockAtWhatProductionConsumed(t *testing.T) {
	for _, tc := range []struct {
		name     string
		consumed float64
		quantity float64
	}{
		{"100.00 into 3 cakes (was 99.99, leaving 0.01 in WIP)", 100, 3},
		{"10.00 into 7 (was 10.01, WIP overdrawn by 0.01)", 10, 7},
		{"1.00 into 1,000 biscuits (was 0.00: no stock value at all)", 1, 1000},
		{"the measured batch MFG-000001: 270.00 into 1", 270, 1},
		{"a fractional yield", 45.5, 2.5},
	} {
		unitCost := productionOutputUnitCost(tc.consumed, tc.quantity)
		// calculateValuation values a stock-in as unit cost x quantity, to cents.
		stockIn := unitCost.Mul(money.FromFloat(tc.quantity)).Round2()
		if !stockIn.Equal(money.FromFloat(tc.consumed).Round2()) {
			t.Errorf("%s: output enters stock at %s, want %.2f -- the difference is stranded in Work in Process",
				tc.name, stockIn, tc.consumed)
		}
	}
	if !productionOutputUnitCost(100, 0).IsZero() {
		t.Error("no output quantity must give a zero unit cost, not a division by zero")
	}
}

// Regression: ISSUE-044 — "Record wastage" on a batch could never succeed.
//
// On production on 2026-09-16 the batch menu offered it only on completed
// batch MFG-000001, and the server answered "only planned or in_progress
// batches can record wastage". Had it been accepted, it stored a bare number:
// the item picked and the reason were ignored and no stock left the shelf.
// Owner decision the same day: batch wastage is real wastage.
func TestBatchWastageWritesOffFinishedGoods(t *testing.T) {
	body := manufacturingFunctionBody(t, "func (s *Service) RecordWastage(")
	for _, want := range []string{
		`if batch.Status != "completed" {`,
		`s.repo.Output(tx, id, currentUser.BusinessID)`,
		`InventoryItemID: output.InventoryItemID,`,
		`MovementType:    "wastage",`,
		`ReferenceType:   productionWastageReferenceType,`,
		`s.accountingService.PostInventoryMovementJournal(tx, currentUser, movement.ID)`,
		`"wastage_quantity":   roundQuantity(batch.WastageQuantity + wastageQuantity),`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("RecordWastage must contain %q: wastage on a produced batch takes the output out of stock, "+
				"posts it to Wastage Expense, and adds to the batch's total", want)
		}
	}
	if strings.Contains(body, `batch.Status != "planned"`) {
		t.Error("RecordWastage still restricts wastage to planned batches, where nothing exists to waste")
	}
	if productionWastageReferenceType == "production_batch" {
		t.Error("write-offs must not share the batch's reference: the batch journal sums that reference's wastage at completion")
	}
}

func TestBatchWastageCannotExceedWhatWasProduced(t *testing.T) {
	for _, tc := range []struct {
		produced, wasted, want float64
	}{
		{10, 0, 10},
		{10, 2, 8},
		{10, 10, 0},
		{10, 12, 0},
		{2.5, 0.25, 2.25},
	} {
		if got := batchWastageRemaining(tc.produced, tc.wasted); got != tc.want {
			t.Errorf("batchWastageRemaining(%v, %v) = %v, want %v", tc.produced, tc.wasted, got, tc.want)
		}
	}
	if got := batchWastageLimitMessage(8, "pcs"); got != "Only 8 pcs of this batch can still be written off." {
		t.Errorf("limit message = %q", got)
	}
	if got := batchWastageLimitMessage(0, "pcs"); got != "All of this batch has already been written off." {
		t.Errorf("exhausted message = %q", got)
	}
}

// The request the dialog sends carries "reason"; it used to be dropped.
func TestWastageRequestReadsReason(t *testing.T) {
	if got := (WastageBatchRequest{Quantity: 2, Reason: "Dropped"}).ReasonValue(); got != "Dropped" {
		t.Errorf("ReasonValue = %q, want the reason the dialog sent", got)
	}
}

// Regression: ISSUE-043 — a batch produced in one step showed "Start time: Not set".
func TestProducingABatchRecordsItsStartTime(t *testing.T) {
	body := manufacturingFunctionBody(t, "func (s *Service) completeBatchTx(")
	if !strings.Contains(body, "if batch.StartedAt == nil {\n\t\tcompletion[\"started_at\"] = now\n\t}") {
		t.Error("completeBatchTx must set started_at when the batch was never started: Produce now and " +
			"Produce planned skip Start, and the finished batch read \"Start time: Not set\"")
	}
}

func manufacturingFunctionBody(t *testing.T, marker string) string {
	t.Helper()
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, marker)
	if start == -1 {
		t.Fatalf("%s not found", marker)
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}
