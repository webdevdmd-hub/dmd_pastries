package payments

import "testing"

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
