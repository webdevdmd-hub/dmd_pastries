package roles

import (
	"sort"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

// Regression: ISSUE-057 — role changes left no trace.
//
// Creating, renaming, deleting a role and changing its permissions wrote
// nothing to the audit log, although these are the most sensitive changes in
// the app. On production on 2026-09-17 the Cashier role in Jo_bakes carried
// every Products and Recipes permission (the default grants only
// products.view) and there was no record of who added them or when.

// SetAuditRepository enables audit entries for role changes.
func (s *Service) SetAuditRepository(repo *audit.Repository) {
	s.auditRepo = repo
}

func (s *Service) writeRoleAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, roleID, summary string, metadata map[string]interface{}, ipAddress, userAgent string) error {
	if s.auditRepo == nil {
		return nil
	}
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "role",
		EntityID:    roleID,
		Summary:     summary,
		Metadata:    metadata,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

// permissionChanges lists what a replacement adds and removes, so the entry
// says "added products.delete" rather than only "permissions updated".
func permissionChanges(before, after []string) (added, removed []string) {
	was := make(map[string]struct{}, len(before))
	for _, key := range before {
		was[key] = struct{}{}
	}
	is := make(map[string]struct{}, len(after))
	added, removed = []string{}, []string{}
	for _, key := range after {
		is[key] = struct{}{}
		if _, ok := was[key]; !ok {
			added = append(added, key)
		}
	}
	for _, key := range before {
		if _, ok := is[key]; !ok {
			removed = append(removed, key)
		}
	}
	sort.Strings(added)
	sort.Strings(removed)
	return added, removed
}
