package reports

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"pastries-pos/internal/modules/reports/shared"
)

// Phase 6 / W2: the financial trend reads the ledger.

func TestLedgerPeriodGranularityMapsGroupBy(t *testing.T) {
	for groupBy, expected := range map[string]string{
		"day": "day", "week": "week", "month": "month",
		// group_by also accepts payment_method, which is meaningless for a
		// time series; it must fall back rather than reach DATE_TRUNC.
		"payment_method": "day", "": "day", "nonsense": "day",
	} {
		if got := shared.LedgerPeriodGranularity(groupBy); got != expected {
			t.Fatalf("group_by %q: got %q, want %q", groupBy, got, expected)
		}
	}
}

// The granularity is interpolated into the SQL rather than bound, so it must
// never be able to carry caller input through.
func TestLedgerPeriodGranularityIsAClosedSet(t *testing.T) {
	got := shared.LedgerPeriodGranularity("day'); DROP TABLE journal_entries; --")
	if got != "day" {
		t.Fatalf("unexpected granularity %q for hostile input", got)
	}
}

// The year-end close zeroes income into retained earnings. If it could reach
// a bucket, every closed year's trend would be distorted by a journal that
// represents no trading activity. Both source sets are allow-lists, which is
// what keeps it out -- assert that rather than trusting it.
func TestTrendSourceAllowListsExcludeStructuralJournals(t *testing.T) {
	for _, sourceType := range append(
		append([]string{}, shared.CollectionJournalSources...),
		shared.RefundJournalSources...,
	) {
		for _, banned := range []string{"year_end_close", "account_opening_balance", "counterparty_opening_balance", "journal_reversal"} {
			if sourceType == banned {
				t.Fatalf("%q must not contribute to a trading trend", banned)
			}
		}
	}
}

func TestFinancialTrendLabelsMatchGranularity(t *testing.T) {
	bucket := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	if got := formatBucket(bucket, "month"); got != "2026-01" {
		t.Fatalf("a monthly bucket should be labelled 2026-01, got %q", got)
	}
	if got := formatBucket(bucket, "day"); got != "2026-01-01" {
		t.Fatalf("a daily bucket should be labelled 2026-01-01, got %q", got)
	}
}

// The trend must stay a fixed number of queries regardless of how many
// buckets the window covers: a per-bucket call to LedgerFinancialTotals would
// be eight queries times the bucket count.
func TestTrendDoesNotCallLedgerTotalsPerBucket(t *testing.T) {
	body := functionBody(t, repositorySource(t), "FinancialTrendFromLedger")
	if strings.Contains(body, "shared.LedgerFinancialTotals(") {
		t.Fatal("the trend must use the grouped query, not the per-window totals helper")
	}
	if !strings.Contains(body, "shared.LedgerFinancialTotalsByPeriod(") {
		t.Fatal("the trend must read its buckets from the grouped ledger query")
	}
}

// Drift is aggregated across the window; one missing journal must not emit a
// warning per bucket.
func TestTrendReportsDriftOncePerMetric(t *testing.T) {
	body := functionBody(t, repositorySource(t), "FinancialTrendFromLedger")
	if got := strings.Count(body, "ledgerDriftWarnings("); got != 1 {
		t.Fatalf("expected a single aggregated drift check, found %d", got)
	}
	for _, metric := range []string{"trend_total_collected", "trend_total_refunded"} {
		if !strings.Contains(body, metric) {
			t.Fatalf("missing drift metric %q", metric)
		}
	}
}

// parseTrend on the frontend reads only labels and datasets and ignores
// unknown keys, so the response must keep that shape and add to it.
func TestFinancialTrendResponseKeepsChartShape(t *testing.T) {
	payload, err := json.Marshal(FinancialTrendResponse{
		Labels:        []string{"2026-01"},
		Datasets:      []shared.ChartDataset{{Label: "Collected", Data: []float64{10}}},
		SourceOfTruth: journalSourceOfTruth,
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	decoded := map[string]interface{}{}
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := decoded["labels"].([]interface{}); !ok {
		t.Fatal("response must keep a top-level labels array")
	}
	if _, ok := decoded["datasets"].([]interface{}); !ok {
		t.Fatal("response must keep a top-level datasets array")
	}
	if decoded["source_of_truth"] != "journal_entries" {
		t.Fatalf("unexpected provenance: %v", decoded["source_of_truth"])
	}
	if _, present := decoded["consistency_warnings"]; present {
		t.Fatal("consistency_warnings must be omitted when there is no drift")
	}
}
