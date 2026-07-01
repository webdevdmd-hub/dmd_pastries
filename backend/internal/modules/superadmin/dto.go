package superadmin

import "time"

type BusinessSummaryResponse struct {
	ID                 string     `json:"id"`
	BusinessName       string     `json:"business_name"`
	OwnerUserID        *string    `json:"owner_user_id"`
	OwnerName          *string    `json:"owner_name"`
	OwnerEmail         *string    `json:"owner_email"`
	Currency           string     `json:"currency"`
	Timezone           string     `json:"timezone"`
	VatNumber          string     `json:"vat_number"`
	Status             string     `json:"status"`
	SubscriptionStatus *string    `json:"subscription_status"`
	PlanType           *string    `json:"plan_type"`
	UsersCount         int64      `json:"users_count"`
	BranchesCount      int64      `json:"branches_count"`
	RolesCount         int64      `json:"roles_count"`
	CreatedAt          time.Time  `json:"created_at"`
	DeletedAt          *time.Time `json:"deleted_at"`
}

type BusinessDetailResponse struct {
	Business     BusinessSummaryResponse `json:"business"`
	Users        []UserSummaryResponse   `json:"users"`
	Branches     []BranchSummaryResponse `json:"branches"`
	Roles        []RoleSummaryResponse   `json:"roles"`
	Subscription *SubscriptionResponse   `json:"subscription"`
	Warnings     []DiagnosticResponse    `json:"warnings"`
}

type UpdateBusinessActionRequest struct {
	Reason       string  `json:"reason" binding:"required"`
	BusinessName *string `json:"business_name"`
	Currency     *string `json:"currency"`
	Timezone     *string `json:"timezone"`
	VatNumber    *string `json:"vat_number"`
	Status       *string `json:"status"`
	OwnerUserID  *string `json:"owner_user_id"`
}

type BusinessActionResponse struct {
	Business BusinessDetailResponse `json:"business"`
	Action   string                 `json:"action"`
}

type UserSummaryResponse struct {
	ID                   string     `json:"id"`
	AppwriteUserID       string     `json:"appwrite_user_id"`
	BusinessID           string     `json:"business_id"`
	BusinessName         string     `json:"business_name"`
	BranchID             *string    `json:"branch_id"`
	BranchName           *string    `json:"branch_name"`
	CurrentBranchID      *string    `json:"current_branch_id"`
	RoleID               string     `json:"role_id"`
	RoleName             string     `json:"role_name"`
	FullName             string     `json:"full_name"`
	Email                string     `json:"email"`
	Phone                string     `json:"phone"`
	Status               string     `json:"status"`
	EmailVerified        bool       `json:"email_verified"`
	CanAccessAllBranches bool       `json:"can_access_all_branches"`
	LastLoginAt          *time.Time `json:"last_login_at"`
	CreatedAt            time.Time  `json:"created_at"`
	DeletedAt            *time.Time `json:"deleted_at"`
}

type UserDetailResponse struct {
	User              UserSummaryResponse       `json:"user"`
	Permissions       []string                  `json:"permissions"`
	BranchAccess      []BranchSummaryResponse   `json:"branch_access"`
	AuditLogs         []AuditLogSummaryResponse `json:"audit_logs"`
	RelatedDataCounts []RelatedDataCount        `json:"related_data_counts"`
	Warnings          []DiagnosticResponse      `json:"warnings"`
}

type UpdateUserActionRequest struct {
	Reason               string   `json:"reason" binding:"required"`
	Operation            *string  `json:"operation"`
	ConfirmationText     *string  `json:"confirmation_text"`
	FullName             *string  `json:"full_name"`
	Email                *string  `json:"email"`
	Phone                *string  `json:"phone"`
	Status               *string  `json:"status"`
	RoleID               *string  `json:"role_id"`
	BranchID             *string  `json:"branch_id"`
	CanAccessAllBranches *bool    `json:"can_access_all_branches"`
	BranchAccessIDs      []string `json:"branch_access_ids"`
}

type UserActionResponse struct {
	User   UserDetailResponse `json:"user"`
	Action string             `json:"action"`
}

type HardDeletePreviewResponse struct {
	UserID              string             `json:"user_id"`
	Email               string             `json:"email"`
	IsSoftDeleted       bool               `json:"is_soft_deleted"`
	CanHardDelete       bool               `json:"can_hard_delete"`
	RequiresSoftDelete  bool               `json:"requires_soft_delete"`
	BlockingCounts      []RelatedDataCount `json:"blocking_counts"`
	CleanupCounts       []RelatedDataCount `json:"cleanup_counts"`
	TotalBlockingRows   int64              `json:"total_blocking_rows"`
	TotalCleanupRows    int64              `json:"total_cleanup_rows"`
	Decision            string             `json:"decision"`
	RequiredConfirmText string             `json:"required_confirm_text"`
}

type BranchSummaryResponse struct {
	ID         string `json:"id"`
	BranchName string `json:"branch_name"`
	Code       string `json:"code"`
	Status     string `json:"status"`
	IsDefault  bool   `json:"is_default"`
}

type RoleSummaryResponse struct {
	ID              string     `json:"id"`
	RoleName        string     `json:"role_name"`
	Description     string     `json:"description"`
	IsSystemDefault bool       `json:"is_system_default"`
	UsersCount      int64      `json:"users_count"`
	DeletedAt       *time.Time `json:"deleted_at"`
}

type SubscriptionResponse struct {
	ID          string     `json:"id"`
	PlanType    string     `json:"plan_type"`
	Status      string     `json:"status"`
	UserLimit   int        `json:"user_limit"`
	BranchLimit int        `json:"branch_limit"`
	TrialEndsAt *time.Time `json:"trial_ends_at"`
	RenewalDate *time.Time `json:"renewal_date"`
}

type AuditLogSummaryResponse struct {
	ID          string    `json:"id"`
	EventType   string    `json:"event_type"`
	EntityType  string    `json:"entity_type"`
	EntityID    string    `json:"entity_id"`
	Summary     string    `json:"summary"`
	ActorUserID string    `json:"actor_user_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type RelatedDataCount struct {
	Module string `json:"module"`
	Table  string `json:"table"`
	Count  int64  `json:"count"`
}

type DiagnosticResponse struct {
	ID         string  `json:"id"`
	Severity   string  `json:"severity"`
	Category   string  `json:"category"`
	Summary    string  `json:"summary"`
	BusinessID *string `json:"business_id"`
	UserID     *string `json:"user_id"`
}

type TableColumnResponse struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Editable bool   `json:"editable"`
	Masked   bool   `json:"masked"`
}

type TableDefinitionResponse struct {
	Key         string                `json:"key"`
	Label       string                `json:"label"`
	Description string                `json:"description"`
	Columns     []TableColumnResponse `json:"columns"`
	CanUpdate   bool                  `json:"can_update"`
}

type TableRowsResponse struct {
	Table      TableDefinitionResponse  `json:"table"`
	Rows       []map[string]interface{} `json:"rows"`
	Page       int                      `json:"page"`
	Limit      int                      `json:"limit"`
	TotalRows  int64                    `json:"total_rows"`
	TotalPages int                      `json:"total_pages"`
}

type UpdateTableRowRequest struct {
	Reason string                 `json:"reason" binding:"required"`
	Values map[string]interface{} `json:"values" binding:"required"`
}

type TableRowActionResponse struct {
	Table  string                 `json:"table"`
	RowID  string                 `json:"row_id"`
	Row    map[string]interface{} `json:"row"`
	Action string                 `json:"action"`
}
