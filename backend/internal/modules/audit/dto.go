package audit

import (
	"encoding/json"
	"time"
)

type ActivityLogResponse struct {
	ID           string                 `json:"id"`
	BusinessID   string                 `json:"business_id"`
	ActorUserID  string                 `json:"actor_user_id"`
	TargetUserID *string                `json:"target_user_id"`
	EventType    string                 `json:"event_type"`
	EntityType   string                 `json:"entity_type"`
	EntityID     string                 `json:"entity_id"`
	Summary      string                 `json:"summary"`
	Metadata     map[string]interface{} `json:"metadata"`
	CreatedAt    time.Time              `json:"created_at"`
}

type ActivityLogListResponse struct {
	Items      []ActivityLogResponse `json:"items"`
	NextCursor *string               `json:"next_cursor"`
}

func ToActivityLogResponse(log AuditLog) ActivityLogResponse {
	metadata := map[string]interface{}{}
	if log.Metadata != "" {
		_ = json.Unmarshal([]byte(log.Metadata), &metadata)
	}

	eventType := firstNonEmpty(log.EventType, log.ActionType, "settings.updated")
	entityType := firstNonEmpty(log.EntityType, log.ModuleName, "settings")
	entityID := firstNonEmpty(log.EntityID, log.ReferenceID, log.ID)
	summary := firstNonEmpty(log.Summary, eventType)

	if !frontendSupportedEventType(eventType) {
		metadata["original_event_type"] = eventType
		eventType = "settings.updated"
	}
	if !frontendSupportedEntityType(entityType) {
		metadata["original_entity_type"] = entityType
		entityType = "settings"
	}

	return ActivityLogResponse{
		ID:           log.ID,
		BusinessID:   log.BusinessID,
		ActorUserID:  log.ActorUserID,
		TargetUserID: log.TargetUserID,
		EventType:    eventType,
		EntityType:   entityType,
		EntityID:     entityID,
		Summary:      summary,
		Metadata:     metadata,
		CreatedAt:    log.CreatedAt,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func frontendSupportedEntityType(value string) bool {
	switch value {
	case "auth", "business", "user", "role", "settings", "branch", "pos":
		return true
	default:
		return false
	}
}

func frontendSupportedEventType(value string) bool {
	switch value {
	case "auth.login",
		"auth.logout",
		"business.updated",
		"branch.created",
		"branch.updated",
		"user.invited",
		"user.invitation_accepted",
		"user.invitation_cancelled",
		"user.invitation_resent",
		"user.created",
		"user.updated",
		"user.status_changed",
		"user.branch_assigned",
		"user.branch_switched",
		"user.soft_deleted",
		"user.restored",
		"role.created",
		"role.updated",
		"role.permissions_updated",
		"settings.updated":
		return true
	default:
		return false
	}
}
