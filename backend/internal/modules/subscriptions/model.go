package subscriptions

import "time"

type Subscription struct {
	ID          string     `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID  string     `gorm:"type:uuid;not null;index" json:"business_id"`
	PlanType    string     `gorm:"size:50;not null" json:"plan_type"`
	Status      string     `gorm:"size:50;not null" json:"status"`
	UserLimit   int        `gorm:"not null;default:5" json:"user_limit"`
	BranchLimit int        `gorm:"not null;default:1" json:"branch_limit"`
	TrialEndsAt *time.Time `json:"trial_ends_at"`
	RenewalDate *time.Time `json:"renewal_date"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (Subscription) TableName() string {
	return "subscriptions"
}
