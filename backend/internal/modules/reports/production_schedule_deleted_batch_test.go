package reports

import (
	"strings"
	"testing"
)

// Regression: ISSUE-090 — the production schedule still showed a deleted
// production batch against the bakery order item it was made for.
//
// The report joined production_batches without checking deleted_at, so a
// deleted batch's number and status stayed on the schedule and its note said
// "Production assigned to batch". A deleted batch is now no batch at all, and
// the note says the record has no linked batch.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md
func TestTheProductionScheduleIgnoresDeletedBatches(t *testing.T) {
	query, _ := bakeryOrdersProductionScheduleSQL(testBakeryOrdersReportFilter())
	compact := strings.Join(strings.Fields(query), " ")

	join := "LEFT JOIN production_batches pb ON pb.id = bop.production_batch_id AND pb.business_id = bo.business_id AND pb.deleted_at IS NULL"
	if !strings.Contains(compact, join) {
		t.Fatalf("the production schedule joins deleted batches: %s", query)
	}
	if !strings.Contains(compact, "WHEN pb.id IS NULL THEN 'Production record exists without a linked batch.'") {
		t.Fatalf("a row whose batch was deleted is not described as having no linked batch: %s", query)
	}
}
