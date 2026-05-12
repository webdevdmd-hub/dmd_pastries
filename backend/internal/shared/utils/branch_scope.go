package utils

import (
	"strings"

	apperrors "pastries-pos/internal/shared/errors"
)

func (ctx *AuthContext) CanAccessBranch(branchID string) bool {
	branchID = strings.TrimSpace(branchID)
	if ctx == nil || branchID == "" {
		return false
	}
	if ctx.CanAccessAllBranches {
		return true
	}
	for _, allowedBranchID := range ctx.AllowedBranchIDs {
		if allowedBranchID == branchID {
			return true
		}
	}
	return false
}

func (ctx *AuthContext) ResolveBranchScope(requestedBranchID, requestedScope string) (branchID string, allBranches bool, err error) {
	if ctx == nil {
		return "", false, apperrors.Unauthorized("missing authenticated user")
	}

	requestedBranchID = strings.TrimSpace(requestedBranchID)
	requestedScope = strings.TrimSpace(requestedScope)
	if requestedScope == "all_branches" || requestedBranchID == "all" {
		if !ctx.CanAccessAllBranches {
			return "", false, apperrors.Forbidden("all-branch access is not allowed")
		}
		return "", true, nil
	}
	if ctx.CurrentBranchID != nil && strings.TrimSpace(*ctx.CurrentBranchID) != "" {
		currentBranchID := strings.TrimSpace(*ctx.CurrentBranchID)
		if !ctx.CanAccessBranch(currentBranchID) {
			return "", false, apperrors.Forbidden("current branch access denied")
		}
		if requestedBranchID != "" && requestedBranchID != currentBranchID {
			return "", false, apperrors.Forbidden("switch branch before accessing another branch")
		}
		return currentBranchID, false, nil
	}
	if requestedBranchID != "" {
		if !ctx.CanAccessBranch(requestedBranchID) {
			return "", false, apperrors.Forbidden("branch access denied")
		}
		return requestedBranchID, false, nil
	}
	if ctx.AssignedBranchID != nil && strings.TrimSpace(*ctx.AssignedBranchID) != "" {
		if !ctx.CanAccessBranch(*ctx.AssignedBranchID) {
			return "", false, apperrors.Forbidden("assigned branch access denied")
		}
		return *ctx.AssignedBranchID, false, nil
	}
	if ctx.CanAccessAllBranches {
		return "", true, nil
	}
	return "", false, apperrors.Forbidden("user has no assigned branch")
}

func (ctx *AuthContext) ResolveOperationalBranch(requestedBranchID string) (string, error) {
	branchID, allBranches, err := ctx.ResolveBranchScope(requestedBranchID, "")
	if err != nil {
		return "", err
	}
	if allBranches {
		return "", apperrors.BadRequest("branch_id is required for this operation", nil)
	}
	return branchID, nil
}
