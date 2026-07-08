package payments

import "testing"

func TestDailySummaryFromOperationalUsesMethodSummaryTotals(t *testing.T) {
	rows := mergePaymentSummaryRows([]PaymentSummaryByMethod{
		{
			PaymentMethodID:   "cash",
			PaymentMethodName: "Cash",
			CollectedAmount:   150,
			TransactionCount:  2,
		},
		{
			PaymentMethodID:   "card",
			PaymentMethodName: "Card",
			CollectedAmount:   100,
			TransactionCount:  1,
		},
	}, []PaymentSummaryByMethod{
		{
			PaymentMethodID:        "card",
			PaymentMethodName:      "Card",
			RefundedAmount:         25,
			RefundTransactionCount: 1,
		},
	})
	for i := range rows {
		rows[i].RefundAmount = rows[i].RefundedAmount
		rows[i].TotalAmount = rows[i].CollectedAmount
		rows[i].NetAmount = roundMoney(rows[i].CollectedAmount - rows[i].RefundedAmount)
	}

	operational := operationalSummaryFromRows(rows, 180, 70, 20, 30, 20)
	daily := dailySummaryFromOperational("2026-07-06", "branch-1", operational, nil)

	if daily.TotalCollected != 250 {
		t.Fatalf("total_collected = %v, want 250", daily.TotalCollected)
	}
	if daily.TotalRefunded != 25 {
		t.Fatalf("total_refunded = %v, want 25", daily.TotalRefunded)
	}
	if daily.NetCollected != 225 {
		t.Fatalf("net_collected = %v, want 225", daily.NetCollected)
	}
	if daily.PaymentsCount != 3 {
		t.Fatalf("payments_count = %d, want 3", daily.PaymentsCount)
	}
	if daily.RefundsCount != 1 {
		t.Fatalf("refunds_count = %d, want 1", daily.RefundsCount)
	}
	if daily.SourceOfTruth != "payment_transactions" {
		t.Fatalf("source_of_truth = %q, want payment_transactions", daily.SourceOfTruth)
	}
	if len(daily.ByMethod) != len(rows) {
		t.Fatalf("by_method length = %d, want %d", len(daily.ByMethod), len(rows))
	}
}

func TestResolvePaymentSummaryRangeDefaultsToAllTime(t *testing.T) {
	summaryRange, err := resolvePaymentSummaryRange("", "", "", "")
	if err != nil {
		t.Fatalf("resolvePaymentSummaryRange returned error: %v", err)
	}
	if summaryRange.DateFrom != "" || summaryRange.DateTo != "" {
		t.Fatalf("expected all-time empty bounds, got from=%q to=%q", summaryRange.DateFrom, summaryRange.DateTo)
	}
	if summaryRange.WarningStartUTC != nil || summaryRange.WarningEndUTC != nil {
		t.Fatalf("all-time summary should not request bounded journal warnings")
	}
}

func TestResolvePaymentSummaryRangeDateShortcutUsesSingleDay(t *testing.T) {
	summaryRange, err := resolvePaymentSummaryRange("2026-07-06", "", "", "Asia/Dubai")
	if err != nil {
		t.Fatalf("resolvePaymentSummaryRange returned error: %v", err)
	}
	if summaryRange.DateLabel != "2026-07-06" {
		t.Fatalf("date label = %q, want 2026-07-06", summaryRange.DateLabel)
	}
	if summaryRange.DateFrom != "2026-07-05T20:00:00Z" {
		t.Fatalf("date_from = %q, want Dubai local start in UTC", summaryRange.DateFrom)
	}
	if summaryRange.DateTo != "2026-07-06T20:00:00Z" {
		t.Fatalf("date_to = %q, want next Dubai local day start in UTC", summaryRange.DateTo)
	}
	if summaryRange.WarningStartUTC == nil || summaryRange.WarningEndUTC == nil {
		t.Fatalf("date shortcut should request bounded journal warnings")
	}
}

func TestResolvePaymentSummaryRangeRangeNormalizesDateToEndOfDay(t *testing.T) {
	summaryRange, err := resolvePaymentSummaryRange("", "2026-07-01", "2026-07-06", "Asia/Dubai")
	if err != nil {
		t.Fatalf("resolvePaymentSummaryRange returned error: %v", err)
	}
	if summaryRange.DateFrom != "2026-06-30T20:00:00Z" {
		t.Fatalf("date_from = %q, want Dubai local range start in UTC", summaryRange.DateFrom)
	}
	if summaryRange.DateTo != "2026-07-06T20:00:00Z" {
		t.Fatalf("date_to = %q, want Dubai local range end in UTC", summaryRange.DateTo)
	}
	if summaryRange.WarningStartUTC == nil || summaryRange.WarningEndUTC == nil {
		t.Fatalf("closed range should request bounded journal warnings")
	}
}

func TestResolvePaymentSummaryRangeRejectsInvalidTimezone(t *testing.T) {
	_, err := resolvePaymentSummaryRange("2026-07-06", "", "", "Not/AZone")
	if err == nil {
		t.Fatal("expected invalid timezone error")
	}
}

func TestMergePaymentSummaryRowsNoRefundsUsesGrossAsNetCount(t *testing.T) {
	rows := mergePaymentSummaryRows([]PaymentSummaryByMethod{
		{
			PaymentMethodID:   "cash",
			PaymentMethodName: "Cash",
			CollectedAmount:   125,
			TransactionCount:  2,
		},
	}, nil)

	if len(rows) != 1 {
		t.Fatalf("expected one method row, got %d", len(rows))
	}
	assertPaymentSummaryCounts(t, rows[0], 2, 0, 2)
	if rows[0].TransactionCount != rows[0].GrossTransactionCount {
		t.Fatalf("transaction_count must remain gross count, got %d want %d", rows[0].TransactionCount, rows[0].GrossTransactionCount)
	}
}

func TestMergePaymentSummaryRowsRefundReducesNetCount(t *testing.T) {
	rows := mergePaymentSummaryRows([]PaymentSummaryByMethod{
		{
			PaymentMethodID:   "card",
			PaymentMethodName: "Card",
			CollectedAmount:   100,
			TransactionCount:  1,
		},
	}, []PaymentSummaryByMethod{
		{
			PaymentMethodID:        "card",
			PaymentMethodName:      "Card",
			RefundedAmount:         100,
			RefundTransactionCount: 1,
		},
	})

	if len(rows) != 1 {
		t.Fatalf("expected one method row, got %d", len(rows))
	}
	assertPaymentSummaryCounts(t, rows[0], 1, 1, 0)
}

func TestMergePaymentSummaryRowsPartialRefundUsesRefundTransactionCount(t *testing.T) {
	rows := mergePaymentSummaryRows([]PaymentSummaryByMethod{
		{
			PaymentMethodID:   "cash",
			PaymentMethodName: "Cash",
			CollectedAmount:   100,
			TransactionCount:  1,
		},
	}, []PaymentSummaryByMethod{
		{
			PaymentMethodID:        "cash",
			PaymentMethodName:      "Cash",
			RefundedAmount:         25,
			RefundTransactionCount: 1,
		},
	})

	if len(rows) != 1 {
		t.Fatalf("expected one method row, got %d", len(rows))
	}
	assertPaymentSummaryCounts(t, rows[0], 1, 1, 0)
	if rows[0].NetAmount != 0 {
		t.Fatalf("merge should not calculate amount netting directly, got %v", rows[0].NetAmount)
	}
}

func TestMergePaymentSummaryRowsCombinesPOSAndBakeryCounts(t *testing.T) {
	rows := mergePaymentSummaryRows([]PaymentSummaryByMethod{
		{
			PaymentMethodID:   "cash",
			PaymentMethodName: "Cash",
			CollectedAmount:   100,
			TransactionCount:  1,
		},
		{
			PaymentMethodID:   "cash",
			PaymentMethodName: "Cash",
			CollectedAmount:   50,
			TransactionCount:  2,
		},
	}, []PaymentSummaryByMethod{
		{
			PaymentMethodID:        "cash",
			PaymentMethodName:      "Cash",
			RefundedAmount:         20,
			RefundTransactionCount: 1,
		},
	})

	if len(rows) != 1 {
		t.Fatalf("expected one method row, got %d", len(rows))
	}
	assertPaymentSummaryCounts(t, rows[0], 3, 1, 2)
	if rows[0].CollectedAmount != 150 {
		t.Fatalf("expected combined collected amount 150, got %v", rows[0].CollectedAmount)
	}
}

func TestMergePaymentSummaryRowsRefundOnlyNeverNegativeNetCount(t *testing.T) {
	rows := mergePaymentSummaryRows(nil, []PaymentSummaryByMethod{
		{
			PaymentMethodID:        "cash",
			PaymentMethodName:      "Cash",
			RefundedAmount:         20,
			RefundTransactionCount: 1,
		},
	})

	if len(rows) != 1 {
		t.Fatalf("expected one method row, got %d", len(rows))
	}
	assertPaymentSummaryCounts(t, rows[0], 0, 1, 0)
}

func assertPaymentSummaryCounts(t *testing.T, row PaymentSummaryByMethod, gross, refunds, net int64) {
	t.Helper()
	if row.GrossTransactionCount != gross {
		t.Fatalf("gross_transaction_count = %d, want %d", row.GrossTransactionCount, gross)
	}
	if row.RefundTransactionCount != refunds {
		t.Fatalf("refund_transaction_count = %d, want %d", row.RefundTransactionCount, refunds)
	}
	if row.NetTransactionCount != net {
		t.Fatalf("net_transaction_count = %d, want %d", row.NetTransactionCount, net)
	}
}
