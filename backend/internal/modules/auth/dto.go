package auth

import "time"

type RegisterOwnerRequest struct {
	FullName        string `json:"full_name" binding:"required"`
	BusinessName    string `json:"business_name" binding:"required"`
	Email           string `json:"email" binding:"required,email"`
	Phone           string `json:"phone" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

type LoginSyncRequest struct {
	JWT string `json:"jwt" binding:"required"`
}

type PasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type PasswordResetCompleteRequest struct {
	UserID          string `json:"user_id" binding:"required"`
	Secret          string `json:"secret" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

type AuthProfileResponse struct {
	UserID               string     `json:"user_id"`
	AppwriteUserID       string     `json:"appwrite_user_id"`
	BusinessID           string     `json:"business_id"`
	CurrentBranchID      *string    `json:"current_branch_id"`
	CurrentBranchName    *string    `json:"current_branch_name"`
	AssignedBranchID     *string    `json:"assigned_branch_id"`
	AssignedBranchName   *string    `json:"assigned_branch_name"`
	AllowedBranchIDs     []string   `json:"allowed_branch_ids"`
	CanAccessAllBranches bool       `json:"can_access_all_branches"`
	RoleID               string     `json:"role_id"`
	RoleName             string     `json:"role_name"`
	Permissions          []string   `json:"permissions"`
	SubscriptionStatus   string     `json:"subscription_status"`
	FullName             string     `json:"full_name"`
	Email                string     `json:"email"`
	Phone                string     `json:"phone"`
	Status               string     `json:"status"`
	EmailVerified        bool       `json:"email_verified"`
	LastLoginAt          *time.Time `json:"last_login_at"`
}

type RegisterOwnerResponse struct {
	BusinessID         string `json:"business_id"`
	UserID             string `json:"user_id"`
	AppwriteUserID     string `json:"appwrite_user_id"`
	RoleID             string `json:"role_id"`
	SubscriptionStatus string `json:"subscription_status"`
}
