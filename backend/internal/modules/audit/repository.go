package audit

import (
	"encoding/base64"
	"encoding/json"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, log *AuditLog) error {
	return tx.Create(log).Error
}

type ActivityInput struct {
	BusinessID   string
	ActorUserID  string
	TargetUserID *string
	EventType    string
	EntityType   string
	EntityID     string
	Summary      string
	Metadata     map[string]interface{}
	IPAddress    string
	UserAgent    string
}

func (r *Repository) CreateActivity(tx *gorm.DB, input ActivityInput) error {
	metadata := "{}"
	if input.Metadata != nil {
		raw, err := json.Marshal(input.Metadata)
		if err != nil {
			return err
		}
		metadata = string(raw)
	}

	targetUserID := input.TargetUserID
	if targetUserID != nil && *targetUserID == "" {
		targetUserID = nil
	}

	return tx.Create(&AuditLog{
		ID:           utils.NewUUID(),
		BusinessID:   input.BusinessID,
		UserID:       input.ActorUserID,
		ModuleName:   input.EntityType,
		ActionType:   input.EventType,
		ReferenceID:  input.EntityID,
		IPAddress:    input.IPAddress,
		UserAgent:    input.UserAgent,
		ActorUserID:  input.ActorUserID,
		TargetUserID: targetUserID,
		EventType:    input.EventType,
		EntityType:   input.EntityType,
		EntityID:     input.EntityID,
		Summary:      input.Summary,
		Metadata:     metadata,
	}).Error
}

func (r *Repository) ListByBusinessAndUser(businessID, userID string, limit int) ([]AuditLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var logs []AuditLog
	err := r.db.
		Where("business_id = ? AND (user_id = ? OR reference_id = ?)", businessID, userID, userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

func (r *Repository) ListActivity(businessID, entityType, targetUserID, cursor string, limit int) ([]AuditLog, string, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := r.db.Where("business_id = ?", businessID)
	if entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if targetUserID != "" {
		query = query.Where("target_user_id = ? OR entity_id = ?", targetUserID, targetUserID)
	}
	if cursor != "" {
		createdAt, id, err := decodeCursor(cursor)
		if err == nil {
			query = query.Where("(created_at < ? OR (created_at = ? AND id < ?))", createdAt, createdAt, id)
		}
	}

	var logs []AuditLog
	err := query.Order("created_at DESC, id DESC").Limit(limit + 1).Find(&logs).Error
	if err != nil {
		return nil, "", err
	}

	nextCursor := ""
	if len(logs) > limit {
		next := logs[limit-1]
		nextCursor = encodeCursor(next.CreatedAt, next.ID)
		logs = logs[:limit]
	}

	return logs, nextCursor, nil
}

func encodeCursor(createdAt time.Time, id string) string {
	payload := createdAt.UTC().Format(time.RFC3339Nano) + "|" + id
	return base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func decodeCursor(cursor string) (time.Time, string, error) {
	raw, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", err
	}
	var timestamp string
	var id string
	for index, char := range string(raw) {
		if char == '|' {
			timestamp = string(raw[:index])
			id = string(raw[index+1:])
			break
		}
	}
	createdAt, err := time.Parse(time.RFC3339Nano, timestamp)
	return createdAt, id, err
}
