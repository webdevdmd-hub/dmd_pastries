package accounting

import (
	"os"
	"regexp"
	"testing"
)

// Every posting-path payment-account lookup must resolve branch mappings first
// (payment_method_account_mappings) and only then fall back to the method's
// default account (audit K4). The default is seeded from branch #1 only, so a
// fallback-only lookup either hard-fails or misposts at every other branch.
func TestPostingPaymentAccountLookupsResolveBranchMappings(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	lookups := []string{
		"ListPOSSalePaymentsForAccounting",
		"FindPOSSalePaymentForAccounting",
		"FindPurchaseInvoicePaymentForAccounting",
		"FindPOSPaymentRefundForAccounting",
		"FindBakeryPaymentForAccounting",
		"FindSalesReturnForAccounting",
	}
	for _, name := range lookups {
		pattern := regexp.MustCompile(`(?s)func \(r \*Repository\) ` + name + `\(.*?\n}`)
		body := pattern.Find(src)
		if body == nil {
			t.Fatalf("%s not found in repository.go; update this guard", name)
		}
		if !regexp.MustCompile(`payment_method_account_mappings`).Match(body) {
			t.Errorf("%s does not join payment_method_account_mappings (fallback-only resolution)", name)
		}
		if !regexp.MustCompile(`COALESCE\(pmam\.payment_account_id, pm\.default_payment_account_id\)`).Match(body) {
			t.Errorf("%s does not prefer the branch mapping over the method default", name)
		}
		if !regexp.MustCompile(`pa\.branch_id IS NULL OR pa\.branch_id =`).Match(body) {
			t.Errorf("%s does not guard the payment account's branch", name)
		}
	}
}
