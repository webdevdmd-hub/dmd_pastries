package roles

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

// Regression: ISSUE-057 — role changes left no trace. See audit.go.

func TestPermissionChangesListAddedAndRemoved(t *testing.T) {
	// The measured case: Cashier reset from everything in Products and Recipes
	// back to products.view.
	before := []string{"pos.sell", "products.view", "products.delete", "recipes.edit"}
	after := []string{"pos.sell", "products.view"}
	added, removed := permissionChanges(before, after)
	if !reflect.DeepEqual(added, []string{}) || !reflect.DeepEqual(removed, []string{"products.delete", "recipes.edit"}) {
		t.Errorf("permissionChanges = added %v removed %v", added, removed)
	}
	added, removed = permissionChanges([]string{"dashboard.view"}, []string{"dashboard.view", "pos.view"})
	if !reflect.DeepEqual(added, []string{"pos.view"}) || !reflect.DeepEqual(removed, []string{}) {
		t.Errorf("permissionChanges = added %v removed %v", added, removed)
	}
}

func TestEveryRoleChangeIsAudited(t *testing.T) {
	for fn, event := range map[string]string{
		"CreateRole":            `"role.created"`,
		"UpdateRole":            `"role.updated"`,
		"UpdateRolePermissions": `"role.permissions_updated"`,
		"DeleteRole":            `"role.deleted"`,
	} {
		body := rolesFunctionBody(t, "func (s *Service) "+fn+"(")
		write := strings.Index(body, "s.writeRoleAudit(tx, currentUser, "+event)
		commit := strings.Index(body, "tx.Commit()")
		if write == -1 || commit == -1 || write > commit {
			t.Errorf("%s must write %s inside its transaction, before commit", fn, event)
		}
	}
	raw, err := os.ReadFile("../../../cmd/api/main.go")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "roleService.SetAuditRepository(auditRepo)") {
		t.Error("main.go must give the role service the audit repository, or nothing is written")
	}
}
