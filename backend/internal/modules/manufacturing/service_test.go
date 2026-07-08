package manufacturing

import "testing"

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
