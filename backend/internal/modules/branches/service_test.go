package branches

import "testing"

func TestToBranchResponse(t *testing.T) {
	branch := Branch{
		ID:         "branch-id",
		BusinessID: "business-id",
		BranchName: "Main Branch",
		Code:       "MAIN",
		Address:    "Dubai",
		Phone:      "+971500000000",
		Status:     "active",
	}

	response := toBranchResponse(branch)
	if response.ID != branch.ID {
		t.Fatalf("expected id %q, got %q", branch.ID, response.ID)
	}
	if response.Name != branch.BranchName {
		t.Fatalf("expected branch name %q, got %q", branch.BranchName, response.Name)
	}
	if response.Code != branch.Code {
		t.Fatalf("expected code %q, got %q", branch.Code, response.Code)
	}
}
