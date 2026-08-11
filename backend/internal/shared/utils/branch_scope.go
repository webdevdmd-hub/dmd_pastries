package utils

import (
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"

	apperrors "pastries-pos/internal/shared/errors"
)

// Branch guard rollout state.
//
// EnsureRecordBranch is the authorization guard for a single record. It ships in
// log-only mode first: violations are logged and counted but not blocked, so the
// set of affected users and endpoints is visible before anyone is locked out.
// Set BRANCH_GUARD_ENFORCE=true to deny instead of warn.
var (
	branchGuardOnce       sync.Once
	branchGuardEnforced   bool
	branchGuardViolations int64

	// Indirected so tests can drive both rollout modes without depending on
	// process-wide environment state.
	branchGuardEnforcement = envBranchGuardEnforcement
)

func envBranchGuardEnforcement() bool {
	branchGuardOnce.Do(func() {
		enforced, err := strconv.ParseBool(strings.TrimSpace(os.Getenv("BRANCH_GUARD_ENFORCE")))
		branchGuardEnforced = err == nil && enforced
	})
	return branchGuardEnforced
}

// BranchGuardViolationCount reports how many record-branch violations have been
// observed since start-up. Surfaced by the accounting readiness report so the
// rollout can be judged on data rather than guesswork.
func BranchGuardViolationCount() int64 {
	return atomic.LoadInt64(&branchGuardViolations)
}

// CanAccessBranch answers "is this branch in my allowed set".
//
// It deliberately ignores CurrentBranchID, so it is NOT an authorization guard
// for a record: a transferred user keeps stale allowed-set entries. Use it only
// for branch pickers and assignment validation. To guard a record, use
// EnsureRecordBranch.
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

// EnsureRecordBranch pins a single-record read or write to the caller's resolved
// branch. Use this for every detail/update/delete guard.
//
// This is the strict counterpart to CanAccessBranch: it compares the record's
// branch against the branch the caller is actually operating in, which is what
// every list endpoint already does via ResolveBranchScope. Callers holding
// all-branch access fall back to allowed-set membership.
func (ctx *AuthContext) EnsureRecordBranch(recordBranchID string) error {
	if ctx == nil {
		return apperrors.Unauthorized("missing authenticated user")
	}

	recordBranchID = strings.TrimSpace(recordBranchID)
	if recordBranchID == "" {
		return apperrors.Forbidden("record has no branch")
	}

	// Membership is the floor and is always enforced, in either rollout mode.
	// Only the stricter current-branch rule below is staged.
	if !ctx.CanAccessBranch(recordBranchID) {
		return apperrors.Forbidden("branch access denied")
	}

	scopeBranchID, allBranches, err := ctx.ResolveBranchScope("", "")
	if err != nil {
		return ctx.reportBranchViolation(recordBranchID, err)
	}
	if allBranches || scopeBranchID == recordBranchID {
		return nil
	}
	return ctx.reportBranchViolation(recordBranchID, apperrors.Forbidden("switch branch before accessing another branch"))
}

func (ctx *AuthContext) EnsureRecordBranchPtr(recordBranchID *string) error {
	if recordBranchID == nil {
		return ctx.EnsureRecordBranch("")
	}
	return ctx.EnsureRecordBranch(*recordBranchID)
}

// reportBranchViolation counts every denial and, while the guard is still in
// log-only mode, lets the request through so the rollout does not break live
// workflows before the logs have been reviewed.
func (ctx *AuthContext) reportBranchViolation(recordBranchID string, denial error) error {
	atomic.AddInt64(&branchGuardViolations, 1)

	currentBranchID := ""
	if ctx.CurrentBranchID != nil {
		currentBranchID = strings.TrimSpace(*ctx.CurrentBranchID)
	}
	mode := "log-only"
	if branchGuardEnforcement() {
		mode = "enforced"
	}
	log.Printf(
		"branch-guard %s: user_id=%s business_id=%s role=%s current_branch_id=%s record_branch_id=%s reason=%v",
		mode, ctx.UserID, ctx.BusinessID, ctx.RoleName, currentBranchID, recordBranchID, denial,
	)

	if branchGuardEnforcement() {
		return denial
	}
	return nil
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
