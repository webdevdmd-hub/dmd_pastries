package accounting

import (
	"testing"

	"pastries-pos/internal/shared/utils"
)

func TestRequiredAccountingBranchUsesCurrentBranch(t *testing.T) {
	branchID := "11111111-1111-4111-8111-111111111111"
	currentUser := &utils.AuthContext{
		CurrentBranchID:      &branchID,
		AllowedBranchIDs:     []string{branchID},
		CanAccessAllBranches: true,
	}

	got, err := requiredAccountingBranch(currentUser, "")
	if err != nil {
		t.Fatalf("requiredAccountingBranch returned error: %v", err)
	}
	if got != branchID {
		t.Fatalf("requiredAccountingBranch = %q, want %q", got, branchID)
	}
}

func TestRequiredAccountingBranchRejectsDifferentSelectedBranch(t *testing.T) {
	currentBranchID := "11111111-1111-4111-8111-111111111111"
	otherBranchID := "22222222-2222-4222-8222-222222222222"
	currentUser := &utils.AuthContext{
		CurrentBranchID:      &currentBranchID,
		AllowedBranchIDs:     []string{currentBranchID, otherBranchID},
		CanAccessAllBranches: true,
	}

	if _, err := requiredAccountingBranch(currentUser, otherBranchID); err == nil {
		t.Fatal("requiredAccountingBranch accepted a branch different from the current branch")
	}
}

func TestRequiredAccountingBranchRejectsAllBranchesWithoutSelection(t *testing.T) {
	currentUser := &utils.AuthContext{CanAccessAllBranches: true}

	if _, err := requiredAccountingBranch(currentUser, ""); err == nil {
		t.Fatal("requiredAccountingBranch accepted all-branch accounting scope")
	}
}
