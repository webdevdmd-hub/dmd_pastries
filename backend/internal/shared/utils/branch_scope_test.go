package utils

import "testing"

func setBranchGuardEnforcement(t *testing.T, enforced bool) {
	t.Helper()
	previous := branchGuardEnforcement
	branchGuardEnforcement = func() bool { return enforced }
	t.Cleanup(func() { branchGuardEnforcement = previous })
}

func enforceBranchGuard(t *testing.T) {
	t.Helper()
	setBranchGuardEnforcement(t, true)
}

func TestEnsureRecordBranchAllowsMatchingCurrentBranch(t *testing.T) {
	enforceBranchGuard(t)

	branchID := "11111111-1111-4111-8111-111111111111"
	ctx := &AuthContext{
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{branchID},
	}

	if err := ctx.EnsureRecordBranch(branchID); err != nil {
		t.Fatalf("EnsureRecordBranch rejected the current branch: %v", err)
	}
}

// The defect this guards: a user transferred from branch A to branch B keeps A
// in AllowedBranchIDs, so CanAccessBranch("A") stays true forever.
// EnsureRecordBranch must deny regardless of the stale allowed-set entry.
func TestEnsureRecordBranchDeniesStaleAllowedBranch(t *testing.T) {
	enforceBranchGuard(t)

	currentBranchID := "22222222-2222-4222-8222-222222222222"
	staleBranchID := "11111111-1111-4111-8111-111111111111"
	ctx := &AuthContext{
		CurrentBranchID:  &currentBranchID,
		AllowedBranchIDs: []string{staleBranchID, currentBranchID},
	}

	if !ctx.CanAccessBranch(staleBranchID) {
		t.Fatal("precondition failed: CanAccessBranch should still allow the stale branch")
	}
	if err := ctx.EnsureRecordBranch(staleBranchID); err == nil {
		t.Fatal("EnsureRecordBranch allowed a record from a branch the user has left")
	}
}

func TestEnsureRecordBranchAllowsAllBranchUserWithinAllowedSet(t *testing.T) {
	enforceBranchGuard(t)

	branchID := "33333333-3333-4333-8333-333333333333"
	ctx := &AuthContext{CanAccessAllBranches: true}

	if err := ctx.EnsureRecordBranch(branchID); err != nil {
		t.Fatalf("EnsureRecordBranch rejected an all-branch user: %v", err)
	}
}

func TestEnsureRecordBranchRejectsEmptyRecordBranch(t *testing.T) {
	enforceBranchGuard(t)

	branchID := "11111111-1111-4111-8111-111111111111"
	ctx := &AuthContext{
		CurrentBranchID:  &branchID,
		AllowedBranchIDs: []string{branchID},
	}

	if err := ctx.EnsureRecordBranch("   "); err == nil {
		t.Fatal("EnsureRecordBranch accepted a record with no branch")
	}
	if err := ctx.EnsureRecordBranchPtr(nil); err == nil {
		t.Fatal("EnsureRecordBranchPtr accepted a nil branch")
	}
}

// While the rollout is in log-only mode the guard must count the violation but
// let the request through, so live workflows are observed before being blocked.
func TestEnsureRecordBranchLogOnlyModeDoesNotBlock(t *testing.T) {
	setBranchGuardEnforcement(t, false)

	currentBranchID := "22222222-2222-4222-8222-222222222222"
	otherBranchID := "11111111-1111-4111-8111-111111111111"
	ctx := &AuthContext{
		CurrentBranchID:  &currentBranchID,
		AllowedBranchIDs: []string{currentBranchID, otherBranchID},
	}

	before := BranchGuardViolationCount()
	if err := ctx.EnsureRecordBranch(otherBranchID); err != nil {
		t.Fatalf("log-only mode blocked the request: %v", err)
	}
	if got := BranchGuardViolationCount(); got <= before {
		t.Fatalf("violation counter did not advance: before=%d after=%d", before, got)
	}
}

// Log-only mode stages the new current-branch rule, but it must never be
// weaker than the allowed-set check it replaces: a branch the user has no
// access to at all is denied in both modes.
func TestEnsureRecordBranchLogOnlyModeStillDeniesForeignBranch(t *testing.T) {
	setBranchGuardEnforcement(t, false)

	currentBranchID := "22222222-2222-4222-8222-222222222222"
	foreignBranchID := "99999999-9999-4999-8999-999999999999"
	ctx := &AuthContext{
		CurrentBranchID:  &currentBranchID,
		AllowedBranchIDs: []string{currentBranchID},
	}

	if err := ctx.EnsureRecordBranch(foreignBranchID); err == nil {
		t.Fatal("log-only mode allowed a branch outside the user's allowed set")
	}
}
