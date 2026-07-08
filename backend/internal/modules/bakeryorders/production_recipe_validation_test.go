package bakeryorders

import (
	"net/http"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
)

func TestProductionRecipeValidationErrorUsesClearMessageAndDetails(t *testing.T) {
	productID := "product-id"
	variantID := "variant-id"
	item := &BakeryOrderItem{
		ID:               "item-id",
		ProductID:        &productID,
		ProductVariantID: &variantID,
		ItemSource:       "catalog",
	}

	err := productionRecipeValidationError("active_recipe_not_found", item, "recipe-id")

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	if appErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("StatusCode = %d, want %d", appErr.StatusCode, http.StatusBadRequest)
	}
	if appErr.Message != noValidProductionRecipeMessage {
		t.Fatalf("Message = %q, want %q", appErr.Message, noValidProductionRecipeMessage)
	}
	details, ok := appErr.Details.(map[string]interface{})
	if !ok {
		t.Fatalf("Details = %T, want map[string]interface{}", appErr.Details)
	}
	for key, want := range map[string]interface{}{
		"reason":             "active_recipe_not_found",
		"item_id":            "item-id",
		"item_source":        "catalog",
		"product_id":         "product-id",
		"product_variant_id": "variant-id",
		"recipe_id":          "recipe-id",
	} {
		if got := details[key]; got != want {
			t.Fatalf("details[%q] = %v, want %v", key, got, want)
		}
	}
}

func TestProductionRecipeValidationErrorHandlesMissingProduct(t *testing.T) {
	item := &BakeryOrderItem{ID: "item-id", ItemSource: "catalog"}

	err := productionRecipeValidationError("item_missing_product", item, "")

	appErr, ok := err.(*apperrors.AppError)
	if !ok {
		t.Fatalf("expected AppError, got %T", err)
	}
	details, ok := appErr.Details.(map[string]interface{})
	if !ok {
		t.Fatalf("Details = %T, want map[string]interface{}", appErr.Details)
	}
	if details["reason"] != "item_missing_product" {
		t.Fatalf("reason = %v, want item_missing_product", details["reason"])
	}
	if _, exists := details["product_id"]; exists {
		t.Fatal("did not expect product_id detail for item without product")
	}
	if _, exists := details["recipe_id"]; exists {
		t.Fatal("did not expect recipe_id detail when no recipe was requested")
	}
}
