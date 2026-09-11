package main

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// pos.view and pos.sell once stood in for whole other modules -- orders,
// customers, payments, returns -- as a stopgap until every tenant had those
// permissions seeded. The seeding happened (000028, 000029); the stopgap
// stayed, and a role "restricted to POS" could open all of them.
//
// The till genuinely needs a handful of calls outside its own module. Those
// are listed here, by the exact permit() text that guards them. Any other
// permit() that names a pos.* permission is the stopgap creeping back, and
// this fails. Same for inventory.view standing in for suppliers/purchasing.
var permitsAllowedToAliasPOS = map[string]string{
	// products: GET /products/pos and /products/lookup only
	`permit("products.view", "pos.view")`: "the till's product grid and barcode lookup",
	// customers: GET /customers/lookup and POST /customers/quick-create only
	`permit("customers.view", "pos.view", "pos.sell")`:                                     "finding a customer at the counter",
	`permit("customers.quick_create", "customers.create", "customers.manage", "pos.sell")`: "adding a customer at the counter",
}

func TestPOSPermissionsUnlockOnlyWhatTheTillNeeds(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	// The pos module's own routes are registered in one block; everything
	// it permits is by definition POS.
	posBlock := regexp.MustCompile(`(?s)pos\.RegisterRoutes\(.*?\n\t\)`).Find(source)
	if posBlock == nil {
		t.Fatal("pos.RegisterRoutes block not found")
	}
	outside := strings.Replace(string(source), string(posBlock), "", 1)

	for _, line := range strings.Split(outside, "\n") {
		call := strings.TrimSpace(line)
		if !strings.HasPrefix(call, "permit(") {
			continue
		}
		call = strings.TrimSuffix(call, ",")
		if strings.Contains(call, `"pos.`) {
			if _, ok := permitsAllowedToAliasPOS[call]; !ok {
				t.Errorf("%s lets a POS-only role into another module; if the till truly needs it, add it to the allow list with the reason", call)
			}
		}
		if strings.Contains(call, `"inventory.view"`) && (strings.Contains(call, `"suppliers.`) || strings.Contains(call, `"purchasing.`)) {
			t.Errorf("%s lets an inventory-only role into suppliers/purchasing", call)
		}
	}

	for allowed := range permitsAllowedToAliasPOS {
		if !strings.Contains(outside, allowed) {
			t.Errorf("allow-listed %s is no longer in main.go -- the till lost a call it needs, or the list is stale", allowed)
		}
	}
}
