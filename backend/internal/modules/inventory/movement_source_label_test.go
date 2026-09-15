package inventory

import (
	"strings"
	"testing"
)

// Regression: ISSUE-019 — bakery order stock movements were labelled as POS sales.
//
// sale_out is shared: the POS consumes stock with it, and so does a bakery order
// when it completes. return_in is shared by sales returns, POS voids and bakery
// order cancellations. The display code chose labels and descriptions from the
// movement TYPE alone, so on production on 2026-09-15 the stock ledger read:
//
//	Movements summary   POS Sale - 5 - 5 moves        (two were bakery orders)
//	ORD-000007 row      Sold through POS Receipt #ORD-000007
//	ORD-000004 row      Sold through POS Receipt #ORD-000004
//
// Neither receipt exists. A stock count reconciled against the till would go
// looking for sales that never happened. The quantities were right throughout;
// only the attribution was wrong.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestBakeryOrderMovementsNameTheirRealSource(t *testing.T) {
	for _, tc := range []struct {
		name        string
		movement    StockMovement
		wantContain string
		mustNot     string
	}{
		{
			name:        "a bakery order completion is not a POS sale",
			movement:    StockMovement{MovementType: "sale_out", ReferenceType: "bakery_order", Reason: "Bakery order completed"},
			wantContain: "Bakery Order",
			mustNot:     "POS",
		},
		{
			name:        "bakery order packaging says it was packaging",
			movement:    StockMovement{MovementType: "sale_out", ReferenceType: "bakery_order", Reason: "Bakery order packaging consumed"},
			wantContain: "Packaging used by Bakery Order",
			mustNot:     "POS",
		},
		{
			name:        "cancelling a completed bakery order restocks, it is not a sales return",
			movement:    StockMovement{MovementType: "return_in", ReferenceType: "bakery_order_cancelled"},
			wantContain: "cancelled Bakery Order",
			mustNot:     "Sales Return",
		},
		{
			name:        "a real POS sale still says so",
			movement:    StockMovement{MovementType: "sale_out", ReferenceType: "sale"},
			wantContain: "POS Receipt",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			description := stockMovementDisplay(tc.movement, "Jo", "", "").MovementDescription
			if !strings.Contains(description, tc.wantContain) {
				t.Errorf("description %q should contain %q", description, tc.wantContain)
			}
			if tc.mustNot != "" && strings.Contains(description, tc.mustNot) {
				t.Errorf("description %q names %q, which is not where this stock went", description, tc.mustNot)
			}
		})
	}

	for _, referenceType := range []string{"bakery_order", "bakery_order_cancelled"} {
		if got := sourceModuleLabel(referenceType, ""); got != "Bakery Orders" {
			t.Errorf("source module for %s is %q; it fell through to a label naming no source", referenceType, got)
		}
	}
}

// A label chosen from the movement type alone cannot know which module caused
// the movement, so for a type that several modules share it must not name one.
// This is the class of the bug, not its first instance.
func TestSharedMovementTypeLabelsNameNoSource(t *testing.T) {
	sourceWords := []string{"POS", "Sales Return", "Bakery", "Purchase", "Manufacturing"}
	for _, sharedType := range []string{"sale_out", "return_in"} {
		label := movementTypeLabel(sharedType)
		for _, word := range sourceWords {
			if strings.Contains(label, word) {
				t.Errorf("movementTypeLabel(%q) = %q names a source (%q), but %s is shared by more than "+
					"one module, and the Movements summary groups every one of them under this label",
					sharedType, label, word, sharedType)
			}
		}
	}
}
