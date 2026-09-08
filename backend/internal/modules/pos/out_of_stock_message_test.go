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
	if !strings.Contains(appErr.Message, "5 needed") || !strings.Contains(appErr.Message, "3 available") {
		t.Errorf("message should carry both figures: %s", appErr.Message)
	}
	// A sentence here would have to agree with the number, and cannot: "only
	// 3 is available" and "only 1 are available" are both wrong.
	if strings.Contains(appErr.Message, " is available") || strings.Contains(appErr.Message, " are available") {
		t.Errorf("message reintroduced a number-agreement trap: %s", appErr.Message)
	}

}

// The client appends the string values of an error's details to its message
// (normalizeBackendError in frontend/src/lib/api/client.ts). Attaching a
// reason code and an item name here put "...: QA Latte, insufficient_stock"
// on the counter screen behind the sentence a cashier actually reads.
func TestOutOfStockErrorCarriesNoAppendableDetails(t *testing.T) {
	for _, err := range []error{
		outOfStockError("QA Latte", 1, 0),
		outOfStockError("QA Flour T55", 5, 3),
	} {
		if details := err.(*apperrors.AppError).Details; details != nil {
			t.Errorf("details %v would be appended to the cashier's message", details)
		}
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
