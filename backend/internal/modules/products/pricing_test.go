package products

import (
	"strings"
	"testing"
)

func TestPricingTargetPOSEligible(t *testing.T) {
	activeVariantID := "variant-1"
	tests := []struct {
		name   string
		target pricingTarget
		want   bool
	}{
		{
			name: "active sellable POS product is eligible",
			target: pricingTarget{
				ProductStatus:       "active",
				ProductIsSellable:   true,
				ProductIsPOSVisible: true,
			},
			want: true,
		},
		{
			name: "POS visible product is not eligible when not sellable",
			target: pricingTarget{
				ProductStatus:       "active",
				ProductIsSellable:   false,
				ProductIsPOSVisible: true,
			},
			want: false,
		},
		{
			name: "sellable product is not eligible when hidden from POS",
			target: pricingTarget{
				ProductStatus:       "active",
				ProductIsSellable:   true,
				ProductIsPOSVisible: false,
			},
			want: false,
		},
		{
			name: "inactive product is not eligible",
			target: pricingTarget{
				ProductStatus:       "inactive",
				ProductIsSellable:   true,
				ProductIsPOSVisible: true,
			},
			want: false,
		},
		{
			name: "active variant inherits eligible parent",
			target: pricingTarget{
				ProductVariantID:    &activeVariantID,
				ProductStatus:       "active",
				ProductIsSellable:   true,
				ProductIsPOSVisible: true,
				VariantStatus:       "active",
			},
			want: true,
		},
		{
			name: "inactive variant is not eligible",
			target: pricingTarget{
				ProductVariantID:    &activeVariantID,
				ProductStatus:       "active",
				ProductIsSellable:   true,
				ProductIsPOSVisible: true,
				VariantStatus:       "inactive",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pricingTargetPOSEligible(tt.target)
			if got != tt.want {
				t.Fatalf("pricingTargetPOSEligible() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPriceSuggestionListPredicateRequiresSellablePOSProduct(t *testing.T) {
	join := posPriceEligibleProductJoin()
	requiredFragments := []string{
		"p.status = 'active'",
		"p.is_sellable = TRUE",
		"p.is_pos_visible = TRUE",
		"p.deleted_at IS NULL",
	}

	for _, fragment := range requiredFragments {
		if !strings.Contains(join, fragment) {
			t.Fatalf("price suggestion product join missing %q in %q", fragment, join)
		}
	}
}

func TestPriceSuggestionListPredicateRequiresActiveVariants(t *testing.T) {
	condition := posPriceEligibleVariantCondition()
	if !strings.Contains(condition, "pps.product_variant_id IS NULL") {
		t.Fatalf("variant condition must allow product-level suggestions, got %q", condition)
	}
	if !strings.Contains(condition, "pv.status = 'active'") {
		t.Fatalf("variant condition must require active variants, got %q", condition)
	}
}
