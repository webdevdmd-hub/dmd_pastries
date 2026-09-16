package recipes

import (
	"os"
	"strings"
	"testing"
)

// Regression: ISSUE-040 — editing a draft recipe changed the live selling price.
//
// recalculateCost runs on every recipe edit and on "Refresh saved cost", and it
// passed the result to the product's pricing whatever the recipe's status. With
// automatic price updates on, a draft repriced the product at the till.
// Measured on production on 2026-09-16: draft RCP-000001 (Vanilla Cake from one
// Black Forest at cost 270.00) was created without effect, and a single "Refresh
// saved cost" moved Vanilla Cake's POS price from AED 357.14 to AED 385.71.
//
// Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
func TestOnlyTheActiveRecipeDrivesTheProductPrice(t *testing.T) {
	for _, tc := range []struct {
		name   string
		recipe *Recipe
		want   bool
	}{
		{"the measured case: a draft", &Recipe{Status: "draft", IsActive: false}, false},
		{"an inactive recipe", &Recipe{Status: "inactive", IsActive: false}, false},
		{"an archived recipe", &Recipe{Status: "archived", IsActive: false}, false},
		{"the active recipe", &Recipe{Status: "active", IsActive: true}, true},
		{"no recipe", nil, false},
	} {
		if got := recipeDrivesProductPrice(tc.recipe); got != tc.want {
			t.Errorf("%s: recipeDrivesProductPrice = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestRecipeCostReachesPricingOnlyThroughTheGate(t *testing.T) {
	body := recipeFunctionBody(t, "func (s *Service) recalculateCost(")
	gate := strings.Index(body, "recipeDrivesProductPrice(recipe)")
	apply := strings.Index(body, "ApplyRecipeCostUpdate(")
	if gate == -1 || apply == -1 || gate > apply {
		t.Error("recalculateCost must check recipeDrivesProductPrice before ApplyRecipeCostUpdate; otherwise " +
			"any edit to a draft reprices the product at the till")
	}
	// The recipe's own estimates must still be saved for a draft -- that is what
	// the builder's saved-cost panel shows.
	if update := strings.Index(body, "UpdateRecipe("); update == -1 || update > gate {
		t.Error("recalculateCost must still store the recipe's estimated costs before the pricing gate")
	}
}

// With drafts no longer repricing, activation is when the price follows the
// recipe. Both ways of activating must apply it.
func TestActivatingARecipeAppliesItsCost(t *testing.T) {
	status := recipeFunctionBody(t, "func (s *Service) UpdateStatus(")
	if !strings.Contains(status, `if req.Status == "active" {`+"\n\t\t\tif err := s.recalculateCost(") {
		t.Error("UpdateStatus must recalculate cost when a recipe becomes active, or activating a draft never " +
			"updates the product's cost and price")
	}
	create := recipeFunctionBody(t, "func (s *Service) Create(")
	persist := strings.Index(create, "CreateRecipe(")
	recalc := strings.Index(create, "if recipe.IsActive {\n\t\t\tif err := s.recalculateCost(")
	if recalc == -1 || persist == -1 || recalc < persist {
		t.Error("Create must recalculate cost after saving a recipe created active (\"Save & activate\")")
	}
}

func recipeFunctionBody(t *testing.T, marker string) string {
	t.Helper()
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	source := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(source, marker)
	if start == -1 {
		t.Fatalf("%s not found", marker)
	}
	rest := source[start+len(marker):]
	if end := strings.Index(rest, "\nfunc "); end != -1 {
		return rest[:end]
	}
	return rest
}
