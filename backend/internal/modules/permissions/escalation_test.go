package permissions

import (
	"reflect"
	"testing"
)

// Regression: ISSUE-056 — see users/escalation.go.
func TestUncoveredPermissions(t *testing.T) {
	manager := []string{"users.view", "users.create", "pos.sell"}
	for _, tc := range []struct {
		name    string
		granted []string
		want    []string
	}{
		{"a role within reach", []string{"pos.sell", "users.view"}, []string{}},
		{"the measured escalation: Admin-only keys", []string{"pos.sell", "accounting.view", "users.delete"}, []string{"accounting.view", "users.delete"}},
		{"deprecated broad keys unlock nothing", []string{"roles.manage", "pos.sell"}, []string{}},
		{"duplicates and blanks", []string{"accounting.view", " accounting.view ", ""}, []string{"accounting.view"}},
	} {
		if got := UncoveredPermissions(manager, tc.granted); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%s: UncoveredPermissions = %v, want %v", tc.name, got, tc.want)
		}
	}
}
