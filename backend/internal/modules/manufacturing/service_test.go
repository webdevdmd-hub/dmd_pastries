package manufacturing

import (
	"net/http"
	"testing"

	apperrors "pastries-pos/internal/shared/errors"
)

func TestBatchCanProduceIncludesBackendPlannedStatus(t *testing.T) {
	cases := []struct {
		status string
		want   bool
	}{
		{status: "draft", want: true},
		{status: "planned", want: true},
		{status: "in_progress", want: true},
		{status: "completed", want: false},
		{status: "cancelled", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.status, func(t *testing.T) {
			if got := batchCanProduce(tc.status); got != tc.want {
				t.Fatalf("batchCanProduce(%q) = %v, want %v", tc.status, got, tc.want)
			}
		})
	}
}

func TestProductionIssueDetailsIncludeBusinessReference(t *testing.T) {
	batch := &ProductionBatch{
		ID:                    "batch-id",
		ProductionBatchNumber: "MFG-000001",
		BranchID:              "branch-id",
		RecipeID:              "recipe-id",
		Status:                "planned",
	}

	details := productionLineIssueDetails("invalid_component_quantity", batch, "line-id", "Flour")

	for key, want := range map[string]interface{}{
		"reason":       "invalid_component_quantity",
		"batch_id":     "batch-id",
		"batch_number": "MFG-000001",
		"branch_id":    "branch-id",
		"recipe_id":    "recipe-id",
		"status":       "planned",
		"line_id":      "line-id",
		"item_name":    "Flour",
	} {
		if got := details[key]; got != want {
			t.Fatalf("details[%q] = %v, want %v", key, got, want)
		}
	}
}

func TestRecipeProductionBOMValidationErrorRequiresComponents(t *testing.T) {
	err := recipeProductionBOMValidationError("branch-id", "recipe-id", 0, 2)

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
		"reason":          "recipe_has_no_components",
		"recipe_id":       "recipe-id",
		"branch_id":       "branch-id",
		"component_count": int64(0),
		"packaging_count": int64(2),
	} {
		if got := details[key]; got != want {
			t.Fatalf("details[%q] = %v, want %v", key, got, want)
		}
	}
}

func TestRecipeProductionBOMValidationErrorAllowsComponentLines(t *testing.T) {
	if err := recipeProductionBOMValidationError("branch-id", "recipe-id", 1, 0); err != nil {
		t.Fatalf("expected component recipe to pass, got %v", err)
	}
}
