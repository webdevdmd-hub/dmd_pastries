package branches

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/testsupport/testdb"
)

// Regression: ISSUE-095 — the default branch, or the only active branch,
// could be marked inactive in one click.
//
// UpdateBranchStatus (and UpdateBranch, whose form also carries a status)
// wrote any status. Marking the default branch inactive left the business
// with a default nobody can work in; marking the last active branch inactive
// left nowhere to sell at all. Both are now refused with 409 and told what to
// do first.
//
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestTheRefusalSaysWhatToDoFirst(t *testing.T) {
	cases := []struct {
		name        string
		branch      Branch
		activeCount int64
		wantMessage string
	}{
		{"default branch", Branch{Status: "active", IsDefault: true}, 3, "Make another branch the default"},
		{"last active branch", Branch{Status: "active"}, 1, "only active branch"},
	}
	for _, tc := range cases {
		err := branchDeactivationRefusal(tc.branch, tc.activeCount)
		var appErr *apperrors.AppError
		if !errors.As(err, &appErr) || appErr.StatusCode != http.StatusConflict {
			t.Errorf("%s: got %v, want 409", tc.name, err)
			continue
		}
		if !strings.Contains(appErr.Message, tc.wantMessage) {
			t.Errorf("%s: %q does not say %q", tc.name, appErr.Message, tc.wantMessage)
		}
	}
	if err := branchDeactivationRefusal(Branch{Status: "active"}, 2); err != nil {
		t.Errorf("a non-default branch with another active branch was refused: %v", err)
	}
	if err := branchDeactivationRefusal(Branch{Status: "inactive", IsDefault: true}, 0); err != nil {
		t.Errorf("an already inactive branch was refused: %v", err)
	}
}

func TestDeactivatingTheDefaultOrLastActiveBranchIsRefused(t *testing.T) {
	db := testdb.Tx(t)
	seeded := testdb.Seed(t, db)
	service := NewService(db, NewRepository(db), audit.NewRepository(db))
	user := seeded.AuthContext()
	inactive := UpdateBranchStatusRequest{Status: "inactive"}

	// The only branch.
	if _, err := service.UpdateBranchStatus(user, seeded.BranchID, inactive, "127.0.0.1", "test"); !isConflict(err) {
		t.Fatalf("marking the only active branch inactive returned %v, want 409", err)
	}

	// A second branch; the first becomes the default.
	secondID := testdb.NewUUID()
	if err := db.Exec(`INSERT INTO branches (id, business_id, branch_name, name, code) VALUES (?, ?, 'Marina', 'Marina', ?)`,
		secondID, seeded.BusinessID, "MR-"+secondID[:8]).Error; err != nil {
		t.Fatalf("seed branch: %v", err)
	}
	if err := db.Exec(`UPDATE branches SET is_default = true WHERE id = ?`, seeded.BranchID).Error; err != nil {
		t.Fatalf("set default: %v", err)
	}
	if _, err := service.UpdateBranchStatus(user, seeded.BranchID, inactive, "127.0.0.1", "test"); !isConflict(err) {
		t.Fatalf("marking the default branch inactive returned %v, want 409", err)
	}
	if _, err := service.UpdateBranch(user, seeded.BranchID, UpdateBranchRequest{Status: "inactive"}, "127.0.0.1", "test"); !isConflict(err) {
		t.Fatalf("the edit form marked the default branch inactive: %v, want 409", err)
	}
	if _, err := service.UpdateBranchStatus(user, secondID, inactive, "127.0.0.1", "test"); err != nil {
		t.Fatalf("marking a non-default branch inactive with another active branch: %v", err)
	}

	var status string
	db.Raw(`SELECT status FROM branches WHERE id = ?`, seeded.BranchID).Scan(&status)
	if status != "active" {
		t.Fatalf("the default branch is %q after the refused changes, want active", status)
	}
}

func isConflict(err error) bool {
	var appErr *apperrors.AppError
	return errors.As(err, &appErr) && appErr.StatusCode == http.StatusConflict
}
