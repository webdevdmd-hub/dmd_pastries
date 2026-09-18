package roles

import (
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Regression: ISSUE-076 — deleting a custom role after its staff were deleted
// returned 409 "role cannot be deleted while assigned to users" while the
// Roles page showed 0 users: the count included soft-deleted staff. Deleting
// a role also wiped the only record of what it allowed.
// Found by /investigate delete audit on 2026-09-18
// Report: .gstack/qa-reports/delete-audit-2026-09-18.md

func TestAssignedUserCountIgnoresDeletedStaff(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{DriverName: "pgx"}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
		Logger:               logger.Discard,
	})
	if err != nil {
		t.Fatalf("open dry-run gorm: %v", err)
	}
	var sql string
	if err := db.Callback().Query().After("gorm:query").Register("test:capture", func(tx *gorm.DB) {
		sql = tx.Statement.SQL.String()
	}); err != nil {
		t.Fatalf("register capture: %v", err)
	}

	if _, err := (&Repository{db: db}).CountAssignedUsers("role-id", "business-id"); err != nil {
		t.Fatalf("CountAssignedUsers: %v", err)
	}
	if !strings.Contains(sql, "deleted_at IS NULL") {
		t.Fatalf("the assigned-user count still counts deleted staff: %s", sql)
	}
}

func TestDeletedRoleKeepsARecordOfItsPermissions(t *testing.T) {
	raw, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	src := strings.ReplaceAll(string(raw), "\r\n", "\n")
	start := strings.Index(src, "func (s *Service) DeleteRole(")
	if start < 0 {
		t.Fatal("DeleteRole not found")
	}
	body := src[start:]
	if end := strings.Index(body[1:], "\nfunc "); end >= 0 {
		body = body[:end+1]
	}
	load := strings.Index(body, "s.repo.GetPermissionKeysByRoleID(roleID)")
	wipe := strings.Index(body, "s.repo.ReplacePermissions(tx, roleID, nil)")
	record := strings.Index(body, `"permission_keys": permissionKeys`)
	if load < 0 || record < 0 {
		t.Fatal("the role.deleted audit entry does not record the role's permissions")
	}
	if wipe >= 0 && load > wipe {
		t.Fatal("the permissions must be read before they are removed")
	}
}
