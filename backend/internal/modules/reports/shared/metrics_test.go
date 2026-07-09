package shared

import (
	"reflect"
	"strings"
	"testing"
)

func TestDashboardFinancialSourceLists(t *testing.T) {
	if !reflect.DeepEqual(RevenueJournalSources, []string{"pos_sale", "bakery_order_revenue", "pos_sale_void", "sales_return"}) {
		t.Fatalf("unexpected revenue journal sources: %#v", RevenueJournalSources)
	}
	if !reflect.DeepEqual(CollectionJournalSources, []string{"pos_sale", "bakery_order_payment"}) {
		t.Fatalf("unexpected collection journal sources: %#v", CollectionJournalSources)
	}
	if !reflect.DeepEqual(RefundJournalSources, []string{"sales_return", "pos_sale_refund"}) {
		t.Fatalf("unexpected refund journal sources: %#v", RefundJournalSources)
	}
}

func TestStockMovementConsistencyQueryDoesNotUseSoftDeleteColumn(t *testing.T) {
	if strings.Contains(stockMovementsMissingJournalsQuery, "sm.deleted_at") {
		t.Fatal("stock_movements consistency query must not reference sm.deleted_at; stock_movements is not soft-deleted")
	}
	if !strings.Contains(stockMovementsMissingJournalsQuery, "stock_movements sm") {
		t.Fatal("expected stock movement consistency query to target stock_movements")
	}
}

func TestBakeryOrderRevenueConsistencyQueryTargetsCompletedLinkedPostedRevenueJournals(t *testing.T) {
	required := []string{
		"bo.order_status = 'completed'",
		"bo.accounting_journal_entry_id IS NULL",
		"je.id = bo.accounting_journal_entry_id",
		"je.source_type = 'bakery_order_revenue'",
		"je.source_id = bo.id",
		"je.status = 'posted'",
	}
	for _, fragment := range required {
		if !strings.Contains(bakeryOrderRevenueMissingJournalsQuery, fragment) {
			t.Fatalf("bakery order revenue consistency query missing %q: %s", fragment, bakeryOrderRevenueMissingJournalsQuery)
		}
	}
	for _, forbidden := range []string{"bo.order_status NOT IN ('cancelled')", "je.status IN ('posted', 'reversed')"} {
		if strings.Contains(bakeryOrderRevenueMissingJournalsQuery, forbidden) {
			t.Fatalf("bakery order revenue consistency query must not contain %q: %s", forbidden, bakeryOrderRevenueMissingJournalsQuery)
		}
	}
}

func TestVendorCreditConsistencyQueryValidatesLinkedPostedPurchaseReturnJournal(t *testing.T) {
	required := []string{
		"prt.status = 'posted'",
		"prt.journal_entry_id IS NULL",
		"je.id = prt.journal_entry_id",
		"je.source_type = 'purchase_return'",
		"je.source_id = prt.id",
		"je.status = 'posted'",
		"stock_movements sm",
		"sm.reference_type = 'purchase_return'",
		"sm.movement_type = 'purchase_return_out'",
		"sm.accounting_journal_entry_id IS DISTINCT FROM prt.journal_entry_id",
	}
	for _, fragment := range required {
		if !strings.Contains(vendorCreditsMissingJournalsQuery, fragment) {
			t.Fatalf("vendor credit consistency query missing %q: %s", fragment, vendorCreditsMissingJournalsQuery)
		}
	}
	if strings.Contains(vendorCreditsMissingJournalsQuery, "je.status IN ('posted', 'reversed')") {
		t.Fatalf("vendor credit consistency query must require a posted source journal: %s", vendorCreditsMissingJournalsQuery)
	}
}
