package reports

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"pastries-pos/internal/modules/reports/shared"
)

func testBakeryOrdersReportFilter() *shared.ResolvedFilter {
	return &shared.ResolvedFilter{
		BusinessID:  "business-id",
		AllBranches: true,
		DateFrom:    time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		DateTo:      time.Date(2026, 7, 31, 23, 59, 59, 0, time.UTC),
		Page:        1,
		Limit:       25,
	}
}

func TestBakeryOrdersUpcomingSQLFiltersActiveStatuses(t *testing.T) {
	query, args, _ := bakeryOrdersUpcomingSQL(testBakeryOrdersReportFilter())

	if !strings.Contains(query, "bo.order_status IN ?") {
		t.Fatalf("expected upcoming orders query to constrain order statuses: %s", query)
	}
	if strings.Contains(query, "completed") || strings.Contains(query, "cancelled") {
		t.Fatalf("upcoming orders query should not hard-code final statuses: %s", query)
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected status filter at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, upcomingBakeryOrderStatuses) {
		t.Fatalf("unexpected upcoming statuses: %#v", statuses)
	}
}

func TestBakeryOrdersProductionScheduleSQLIncludesCompletedAndProductionExplanation(t *testing.T) {
	query, args := bakeryOrdersProductionScheduleSQL(testBakeryOrdersReportFilter())

	for _, expected := range []string{
		"LEFT JOIN LATERAL",
		"COALESCE(bop.status,'not_linked') AS production_status",
		"has_production_record",
		"production_batch_status",
		"production_note",
	} {
		if !strings.Contains(query, expected) {
			t.Fatalf("expected production schedule query to contain %q: %s", expected, query)
		}
	}
	statuses, ok := args[3].([]string)
	if !ok {
		t.Fatalf("expected status filter at args[3], got %T", args[3])
	}
	if !reflect.DeepEqual(statuses, productionScheduleBakeryOrderStatuses) {
		t.Fatalf("unexpected production schedule statuses: %#v", statuses)
	}
	for _, excluded := range []string{"cancelled"} {
		for _, status := range statuses {
			if status == excluded {
				t.Fatalf("production schedule statuses should not include %q: %#v", excluded, statuses)
			}
		}
	}
}
