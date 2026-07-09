package products

import (
	"reflect"
	"strings"
	"testing"
)

func TestProductResponseUsesLoadedUnitID(t *testing.T) {
	tests := []struct {
		name string
		unit ProductUnitInfo
	}{
		{
			name: "piece",
			unit: ProductUnitInfo{ID: "piece-unit-id", UnitName: "Piece", Symbol: "pcs"},
		},
		{
			name: "kilogram",
			unit: ProductUnitInfo{ID: "kilogram-unit-id", UnitName: "Kilogram", Symbol: "kg"},
		},
		{
			name: "milliliter",
			unit: ProductUnitInfo{ID: "milliliter-unit-id", UnitName: "Milliliter", Symbol: "ml"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			product := Product{
				ID:                     "product-id",
				BusinessID:             "business-id",
				BranchID:               "branch-id",
				CategoryID:             "category-id",
				UnitID:                 tt.unit.ID,
				ProductName:            "Unit Test Product",
				ProductCode:            "PRD-UNIT",
				ProductType:            "finished_product",
				ItemStructure:          "single",
				CostUpdatePolicy:       "manual",
				PricingType:            "markup",
				IsPOSVisible:           true,
				IsStockTracked:         true,
				IsCustomOrderAvailable: false,
				Status:                 "active",
			}
			category := ProductCategoryInfo{ID: product.CategoryID, CategoryName: "Category"}

			response := toProductResponse(product, category, tt.unit, nil, nil)

			if response.Unit.ID != tt.unit.ID {
				t.Fatalf("response unit ID = %q, want %q", response.Unit.ID, tt.unit.ID)
			}
			if response.Unit.UnitName != tt.unit.UnitName {
				t.Fatalf("response unit name = %q, want %q", response.Unit.UnitName, tt.unit.UnitName)
			}
			if response.Unit.Symbol != tt.unit.Symbol {
				t.Fatalf("response unit symbol = %q, want %q", response.Unit.Symbol, tt.unit.Symbol)
			}
		})
	}
}

func TestProductResponseUsesUpdatedUnitID(t *testing.T) {
	product := Product{
		ID:                     "product-id",
		BusinessID:             "business-id",
		BranchID:               "branch-id",
		CategoryID:             "category-id",
		UnitID:                 "piece-unit-id",
		ProductName:            "Updated Unit Product",
		ProductCode:            "PRD-UPD",
		ProductType:            "finished_product",
		ItemStructure:          "single",
		CostUpdatePolicy:       "manual",
		PricingType:            "markup",
		IsPOSVisible:           true,
		IsStockTracked:         true,
		IsCustomOrderAvailable: false,
		Status:                 "active",
	}
	category := ProductCategoryInfo{ID: product.CategoryID, CategoryName: "Category"}
	unit := ProductUnitInfo{ID: "piece-unit-id", UnitName: "Piece", Symbol: "pcs"}

	response := toProductResponse(product, category, unit, nil, nil)

	if response.Unit.ID != "piece-unit-id" {
		t.Fatalf("updated response unit ID = %q, want piece-unit-id", response.Unit.ID)
	}
	if response.Unit.UnitName != "Piece" {
		t.Fatalf("updated response unit name = %q, want Piece", response.Unit.UnitName)
	}
}

func TestProductUnitRequestBindingsRequireUUIDs(t *testing.T) {
	createField, ok := reflect.TypeOf(CreateProductRequest{}).FieldByName("UnitID")
	if !ok {
		t.Fatal("CreateProductRequest.UnitID field is missing")
	}
	if got := createField.Tag.Get("binding"); got != "required,uuid" {
		t.Fatalf("CreateProductRequest.UnitID binding = %q, want required,uuid", got)
	}

	updateField, ok := reflect.TypeOf(UpdateProductRequest{}).FieldByName("UnitID")
	if !ok {
		t.Fatal("UpdateProductRequest.UnitID field is missing")
	}
	if got := updateField.Tag.Get("binding"); got != "omitempty,uuid" {
		t.Fatalf("UpdateProductRequest.UnitID binding = %q, want omitempty,uuid", got)
	}
}

func TestVariantLookupRequiresEligiblePOSParentProduct(t *testing.T) {
	query := variantLookupEligibleProductSubquery()
	requiredFragments := []string{
		"product_id IN",
		"business_id = ?",
		"branch_id = ?",
		"status = ?",
		"is_pos_visible = ?",
		"is_sellable = ?",
		"deleted_at IS NULL",
	}

	for _, fragment := range requiredFragments {
		if !strings.Contains(query, fragment) {
			t.Fatalf("variant lookup parent product query missing %q in %q", fragment, query)
		}
	}
}
