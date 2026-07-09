package customers

import (
	"os"
	"strings"
	"testing"
	"time"
)

func TestStatsRepositoryAggregatesPOSAndBakerySources(t *testing.T) {
	source := readCustomerRepositorySource(t)

	for _, expected := range []string{
		`Table("sales")`,
		`pos_sales_amount`,
		`pos_sales_count`,
		`Table("bakery_orders")`,
		`bakery_orders_amount`,
		`bakery_orders_count`,
		`Table("sale_payments sp")`,
		`Table("bakery_order_payments bop")`,
		`Table("payment_refunds pr")`,
		`Table("sale_refunds sr")`,
	} {
		if !strings.Contains(source, expected) {
			t.Fatalf("customer stats aggregation should include %q", expected)
		}
	}
}

func TestStatsRepositoryKeepsCustomerBranchAndStatusScope(t *testing.T) {
	source := readCustomerRepositorySource(t)

	for _, expected := range []string{
		`business_id = ? AND branch_id = ? AND customer_id = ?`,
		`s.customer_id = ?`,
		`bo.customer_id = ?`,
		`sale_status <> ?`,
		`order_status <> ?`,
		`payment_status IN ?`,
		`refund_status = ?`,
		`deleted_at IS NULL`,
		`(total_amount - paid_amount) > 0`,
		`balance_amount > 0`,
	} {
		if !strings.Contains(source, expected) {
			t.Fatalf("customer stats scope should include %q", expected)
		}
	}
}

func TestCustomerRecentTransactionsIncludesAllCustomerActivityTypes(t *testing.T) {
	source := readCustomerRepositorySource(t)

	for _, expected := range []string{
		`'pos_sale' AS source_type`,
		`'bakery_order' AS source_type`,
		`'pos_payment' AS source_type`,
		`'bakery_payment' AS source_type`,
		`'refund' AS source_type`,
		`'sale_refund' AS source_type`,
		`ORDER BY occurred_at DESC`,
		`LIMIT ?`,
	} {
		if !strings.Contains(source, expected) {
			t.Fatalf("customer recent transactions should include %q", expected)
		}
	}
}

func TestLatestCustomerTimeUsesMostRecentPOSOrBakeryDate(t *testing.T) {
	pos := time.Date(2026, 7, 4, 10, 0, 0, 0, time.UTC)
	bakery := time.Date(2026, 7, 6, 0, 0, 0, 0, time.UTC)

	if got := latestCustomerTime(&pos, &bakery); got == nil || !got.Equal(bakery) {
		t.Fatalf("latestCustomerTime(pos, bakery) = %v, want bakery date", got)
	}
	if got := latestCustomerTime(&bakery, &pos); got == nil || !got.Equal(bakery) {
		t.Fatalf("latestCustomerTime(bakery, pos) = %v, want bakery date", got)
	}
	if got := latestCustomerTime(nil, &pos); got == nil || !got.Equal(pos) {
		t.Fatalf("latestCustomerTime(nil, pos) = %v, want pos date", got)
	}
}

func readCustomerRepositorySource(t *testing.T) string {
	t.Helper()
	source, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read customer repository source: %v", err)
	}
	return string(source)
}
