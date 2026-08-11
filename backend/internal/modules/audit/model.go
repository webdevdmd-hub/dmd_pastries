package audit

import "time"

type AuditLog struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID   string    `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID     *string   `gorm:"type:uuid;index" json:"branch_id"`
	UserID       string    `gorm:"type:uuid;not null;index" json:"user_id"`
	ModuleName   string    `gorm:"size:100;not null" json:"module_name"`
	ActionType   string    `gorm:"size:100;not null" json:"action_type"`
	ReferenceID  string    `gorm:"size:100;not null" json:"reference_id"`
	IPAddress    string    `gorm:"size:100" json:"ip_address"`
	UserAgent    string    `gorm:"size:255" json:"user_agent"`
	ActorUserID  string    `gorm:"type:uuid;index" json:"actor_user_id"`
	TargetUserID *string   `gorm:"type:uuid;index" json:"target_user_id"`
	EventType    string    `gorm:"size:150;index" json:"event_type"`
	EntityType   string    `gorm:"size:100;index" json:"entity_type"`
	EntityID     string    `gorm:"size:100;index" json:"entity_id"`
	Summary      string    `gorm:"size:500" json:"summary"`
	Metadata     string    `gorm:"type:jsonb" json:"metadata"`
	CreatedAt    time.Time `json:"created_at"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
