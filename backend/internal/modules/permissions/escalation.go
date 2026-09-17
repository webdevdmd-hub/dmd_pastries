package permissions

import "strings"

// UncoveredPermissions returns the keys in granted that held does not
// include: what a caller would hand out beyond their own access. Deprecated
// broad keys ("roles.manage", ...) are ignored; they unlock nothing on their
// own since access became strict per permission.
//
// Owner decision 2026-09-17 (ISSUE-056): you can only give a role, or add a
// permission to a role, if you already hold every permission it grants.
func UncoveredPermissions(held, granted []string) []string {
	have := make(map[string]struct{}, len(held))
	for _, key := range held {
		have[strings.TrimSpace(key)] = struct{}{}
	}
	missing := make([]string, 0)
	seen := make(map[string]struct{}, len(granted))
	for _, raw := range granted {
		key := strings.TrimSpace(raw)
		if key == "" || IsDeprecatedBroadPermission(key) {
			continue
		}
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		if _, ok := have[key]; !ok {
			missing = append(missing, key)
		}
	}
	return missing
}
