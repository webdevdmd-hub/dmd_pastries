package shared

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// Regression: ISSUE-017 — Financial Reports under-counted payments taken after checkout.
//
// Financial Reports sums money in and money out from the ledger, one journal
// source_type at a time. A source_type missing from these lists is simply never
// asked about, so its money vanishes from Total Collected / Total Refunded while
// the ledger itself stays correct. Nothing fails; the figure is just low.
//
// Measured live on 2026-09-15: a 251.00 balance paid through Payments > Record
// payment posted as pos_sale_payment (Cash in Hand 852.00 in the trial balance)
// while Financial Reports read Total Collected 601.00 -- exactly 251.00 short.
//
// The missing entries are not a matter of opinion. accounting/refund_contract.go
// declares the relationships, so this test reads that contract and holds these
// lists to it, rather than hardcoding a list that can drift the same way again.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestCollectionAndRefundSourcesAreComplete(t *testing.T) {
	collected := toSet(CollectionJournalSources)
	refunded := toSet(RefundJournalSources)

	// The contract calls pos_sale_payment "money collected". It is every tender
	// taken after checkout. Leaving it out is the bug that was measured.
	if !collected["pos_sale_payment"] {
		t.Error("pos_sale_payment must count as collected: the refund contract calls it \"money " +
			"collected\", and without it every payment taken after checkout vanishes from Total " +
			"Collected while the ledger records it correctly")
	}

	// Symmetry, read from the contract: if money IN is counted, the source the
	// contract names as its reversal is money OUT and must be counted too.
	// Otherwise a deposit and its refund net to a positive collection.
	contract := readContract(t)
	reversal := regexp.MustCompile(`Source(\w+):\s*\{ReversedBy:\s*Source(\w+)\}`)
	constant := regexp.MustCompile(`Source(\w+)\s*=\s*"([a-z_]+)"`)

	names := map[string]string{}
	for _, match := range constant.FindAllStringSubmatch(contract, -1) {
		names[match[1]] = match[2]
	}
	if len(names) == 0 {
		t.Fatal("no source_type constants found in refund_contract.go; the test is reading the wrong file")
	}

	checked := 0
	for _, match := range reversal.FindAllStringSubmatch(contract, -1) {
		source, undoneBy := names[match[1]], names[match[2]]
		if !collected[source] {
			continue
		}
		checked++
		if !refunded[undoneBy] {
			t.Errorf("%s is counted as collected, and the refund contract says %s reverses it, but %s "+
				"is not counted as refunded. A collection and its refund would net to a positive "+
				"collection, overstating Net Collected", source, undoneBy, undoneBy)
		}
	}
	if checked == 0 {
		t.Error("no collected source has a declared reversal; bakery_order_payment -> " +
			"bakery_order_advance_refund should have been found, so the contract parse is broken " +
			"and this check would pass vacuously")
	}

	// bakery_order_refund is the post-completion money refund, assembled by the
	// same refund builder as pos_sale_refund. Counting one and not the other
	// makes a refund's visibility depend on which screen issued it.
	if refunded["pos_sale_refund"] && !refunded["bakery_order_refund"] {
		t.Error("bakery_order_refund must count as refunded: it is built by the same refund builder " +
			"as pos_sale_refund, which is counted")
	}

	// Internal movements are not collections. Counting them would double-count
	// money already counted when it first came in.
	for _, internal := range []string{"account_transfer", "platform_settlement"} {
		if collected[internal] {
			t.Errorf("%s moves money between the business's own accounts; counting it as collected "+
				"double-counts money that was already counted on the way in", internal)
		}
	}
}

// Regression: ISSUE-018 — applying a report filter raised false ledger drift.
//
// Ledger totals are scoped by branch and date only. Any other filter narrows the
// operational side and not the ledger, so the two figures stop being comparable.
func TestFiltersTheLedgerCannotApplyNarrowBeyondItsScope(t *testing.T) {
	if (&ResolvedFilter{}).NarrowsBeyondLedgerScope() {
		t.Error("an unfiltered report must still be compared against the ledger")
	}
	if (*ResolvedFilter)(nil).NarrowsBeyondLedgerScope() {
		t.Error("a nil filter must not suppress the comparison")
	}
	if (&ResolvedFilter{Status: "all", SourceType: "all"}).NarrowsBeyondLedgerScope() {
		t.Error(`"all" is the absence of a filter and must not suppress the comparison`)
	}

	for name, filter := range map[string]*ResolvedFilter{
		"payment method (the case measured live)": {PaymentMethodID: "method"},
		"source type":    {SourceType: "bakery_order"},
		"status":         {Status: "completed"},
		"refund status":  {RefundStatus: "completed"},
		"payment status": {PaymentStatus: "partial"},
		"customer":       {CustomerID: "customer"},
		"product":        {ProductID: "product"},
	} {
		if !filter.NarrowsBeyondLedgerScope() {
			t.Errorf("a %s filter narrows the operational data but not the ledger, so comparing them "+
				"reports a difference that is only the filter", name)
		}
	}
}

func toSet(values []string) map[string]bool {
	set := make(map[string]bool, len(values))
	for _, value := range values {
		set[value] = true
	}
	return set
}

func readContract(t *testing.T) string {
	t.Helper()
	raw, err := os.ReadFile("../../accounting/refund_contract.go")
	if err != nil {
		t.Fatalf("read accounting/refund_contract.go: %v", err)
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n")
}
