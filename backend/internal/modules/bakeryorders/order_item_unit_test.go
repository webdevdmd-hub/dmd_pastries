package bakeryorders

import "testing"

func TestCatalogItemUnitMatchesProduct(t *testing.T) {
	if !catalogItemUnitMatchesProduct(" unit-1 ", "unit-1") {
		t.Fatal("expected matching catalog item unit to be accepted")
	}

	if catalogItemUnitMatchesProduct("unit-1", "unit-2") {
		t.Fatal("expected mismatched catalog item unit to be rejected")
	}
}
