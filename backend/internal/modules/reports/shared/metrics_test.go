package shared

import (
	"reflect"
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
