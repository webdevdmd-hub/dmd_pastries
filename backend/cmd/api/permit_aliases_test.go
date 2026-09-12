package main

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

// A permission unlocks its own module and nothing else.
//
// For a long time several permissions stood in for whole other modules --
// pos.view for orders, customers, payments and returns; inventory.view for
// suppliers, purchasing and manufacturing; products.view for recipes;
// settings.* for branches and audit logs; and so on. Each was a stopgap "until
// every tenant has X seeded". The seeding happened; the stopgaps stayed, and
// the Roles screen's 170 boxes stopped meaning what they say.
//
// The exceptions below are the whole list, each with its reason. Any other
// permit() that mixes two modules is the stopgap creeping back, and this
// fails. Adding to the list is allowed; adding silently is not.
var permitsAllowedToMixModules = map[string]string{
	// The till's product grid and barcode lookup: GET /products/pos, /lookup.
	`permit("products.view", "pos.view")`: "the till loads products",
	// The till finds a customer: GET /customers/lookup.
	`permit("customers.view", "pos.view", "pos.sell")`: "the till finds a customer",
	// The till adds one at the counter: POST /customers/quick-create.
	`permit("customers.quick_create", "customers.create", "customers.manage", "pos.sell")`: "the till adds a customer",
	// PATCH /users/:id/branch is branch-access management by definition.
	`permit("branches.access.manage", "users.edit")`: "assigning a user to a branch",
	// Pickers: a form that may write a record needs to name the things the
	// record refers to. Same response shape as the module list, capped and
	// search-driven, unlocked by the writing permissions. /products/picker.
	`permit("products.view", "orders.create", "orders.edit", "purchasing.orders.create", "purchasing.orders.edit", "purchasing.invoices.create", "purchasing.invoices.edit", "purchasing.receipts.create", "recipes.create", "recipes.edit", "manufacturing.batches.create", "manufacturing.batches.edit", "stock_movements.manual_create", "inventory.adjust")`: "product picker for forms",
	// /suppliers/picker.
	`permit("suppliers.view", "purchasing.orders.create", "purchasing.orders.edit", "purchasing.invoices.create", "purchasing.invoices.edit", "purchasing.receipts.create", "expenses.create", "expenses.edit", "accounting.journal_entries.manage", "ingredients.create", "ingredients.edit", "packaging.create", "packaging.edit")`: "supplier picker for forms",
	// /ingredients/lookup: recipe lines and purchase lines name an ingredient.
	`permit("ingredients.view", "recipes.create", "recipes.edit", "recipes.ingredients.manage", "purchasing.orders.create", "purchasing.orders.edit", "purchasing.invoices.create", "purchasing.invoices.edit", "purchasing.receipts.create")`: "ingredient picker for forms",
	// /packaging/lookup: recipe and order packaging lines name a packaging item.
	`permit("packaging.view", "recipes.create", "recipes.edit", "recipes.packaging.manage", "orders.create", "orders.edit", "orders.packaging.manage")`: "packaging picker for forms",
	// /recipes/lookup and /recipes/product/:id: a batch names its recipe.
	`permit("recipes.view", "manufacturing.batches.create", "manufacturing.batches.edit")`: "recipe picker for the batch form",
	// /inventory/picker: a batch names what it consumes.
	`permit("inventory.view", "manufacturing.batches.create", "manufacturing.batches.edit", "manufacturing.batches.consume")`: "inventory picker for the batch form",
	// /users/picker: branch manager and refund approver fields name a colleague.
	`permit("users.view", "branches.create", "branches.edit", "payments.refund", "payments.reconcile")`: "colleague picker for forms",
	// /accounting/customer-credits: the till applies store credit at checkout.
	`permit("accounting.view", "pos.sell", "pos.checkout")`: "the till reads store credit",
	// Two boxes for one feature: the Stock movements module and Inventory's
	// own "movements view". Either is the real permission.
	`permit("stock_movements.view", "inventory.movements.view")`: "stock movements has two equivalent boxes",
}

var permModule = regexp.MustCompile(`"([a-z_]+)\.`)

func TestEveryPermitUnlocksASingleModule(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	for line := range strings.SplitSeq(string(source), "\n") {
		call := strings.TrimSuffix(strings.TrimSpace(line), ",")
		if !strings.HasPrefix(call, "permit(") {
			continue
		}
		modules := map[string]struct{}{}
		for _, m := range permModule.FindAllStringSubmatch(call, -1) {
			modules[m[1]] = struct{}{}
		}
		if len(modules) <= 1 {
			continue
		}
		if _, ok := permitsAllowedToMixModules[call]; !ok {
			t.Errorf("%s unlocks one module with another module's permission; if that is deliberate, add it to the allow list with the reason", call)
		}
	}

	for allowed := range permitsAllowedToMixModules {
		if !strings.Contains(string(source), allowed) {
			t.Errorf("allow-listed %s is no longer in main.go -- a feature lost a call it needs, or the list is stale", allowed)
		}
	}
}

// The only routes any signed-in user may call without a permission are the
// ones that show them their own workspace: the business profile, and the
// reference lookups (internal/modules/lookups). Everything else is behind
// permit().
func TestAnySignedInIsUsedOnlyForOwnBusinessProfile(t *testing.T) {
	source, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	if n := strings.Count(string(source), "\t\tanySignedIn,"); n != 1 {
		t.Errorf("anySignedIn is passed %d times, want exactly 1 (the business profile read)", n)
	}
}
