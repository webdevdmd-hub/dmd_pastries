package pos

import (
	"strings"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
)

// The checkout error reaches the cashier verbatim: pos-workspace.tsx renders
// the backend message under "Checkout failed" without translating it. A
// stock-tracked product that has never had a stock movement used to produce
// "inventory item not found for stock-tracked product X", which named an
// internal table and gave no way forward -- and since every product is created
// stock-tracked, it met anyone selling a product for the first time.
func TestOutOfStockErrorReadsAsAStockProblem(t *testing.T) {
	err := outOfStockError("QA Signature Cake", 2, 0)

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("outOfStockError returned %T, want *apperrors.AppError", err)
	}
	if appErr.Message == "" {
		t.Fatal("message is empty")
	}
	for _, leak := range []string{"inventory item", "inventory_item", "stock-tracked product"} {
		if strings.Contains(strings.ToLower(appErr.Message), leak) {
			t.Errorf("message leaks internals (%q): %s", leak, appErr.Message)
		}
	}
	if !strings.Contains(appErr.Message, "QA Signature Cake") {
		t.Errorf("message does not name the product: %s", appErr.Message)
	}
	if !strings.Contains(appErr.Message, "out of stock") {
		t.Errorf("a zero balance should read as out of stock: %s", appErr.Message)
	}
}

func TestOutOfStockErrorDistinguishesPartialStock(t *testing.T) {
	err := outOfStockError("QA Flour T55", 5, 3)

	appErr := err.(*apperrors.AppError)
	if strings.Contains(appErr.Message, "out of stock") {
		t.Errorf("3 available is not out of stock: %s", appErr.Message)
	}
	if !strings.Contains(appErr.Message, "5") || !strings.Contains(appErr.Message, "3") {
		t.Errorf("message should carry both figures: %s", appErr.Message)
	}

	details, ok := appErr.Details.(map[string]interface{})
	if !ok {
		t.Fatalf("Details is %T, want map[string]interface{}", appErr.Details)
	}
	if details["reason"] != "insufficient_stock" {
		t.Errorf("reason = %v, want insufficient_stock", details["reason"])
	}
	if details["available_quantity"] != 3.0 || details["required_quantity"] != 5.0 {
		t.Errorf("details carry the wrong figures: %v", details)
	}
}

// Quantities are printed for a person, not a debugger.
func TestFormatSaleQuantityDropsTrailingZeros(t *testing.T) {
	cases := map[float64]string{
		2:     "2",
		1.5:   "1.5",
		0:     "0",
		0.25:  "0.25",
		12.75: "12.75",
	}
	for input, want := range cases {
		if got := formatSaleQuantity(input); got != want {
			t.Errorf("formatSaleQuantity(%v) = %q, want %q", input, got, want)
		}
	}
}
