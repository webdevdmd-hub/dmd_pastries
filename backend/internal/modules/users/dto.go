package users

import "time"

type CreateUserRequest struct {
	FullName     string  `json:"full_name" binding:"required"`
	Email        string  `json:"email" binding:"required,email"`
	Phone        string  `json:"phone" binding:"required"`
	Password     string  `json:"password" binding:"required,min=8"`
	RoleID       string  `json:"role_id" binding:"required,uuid"`
	BranchID     *string `json:"branch_id" binding:"required"`
	Status       string  `json:"status" binding:"required,oneof=active inactive suspended invited"`
	AvatarFileID string  `json:"avatar_file_id"`
}

type InviteUserRequest struct {
	FullName     string  `json:"full_name" binding:"required"`
	Email        string  `json:"email" binding:"required,email"`
	Phone        string  `json:"phone"`
	RoleID       string  `json:"role_id" binding:"required,uuid"`
	BranchID     *string `json:"branch_id"`
	AvatarFileID string  `json:"avatar_file_id"`
}

type CreateInvitationRequest struct {
	FullName string  `json:"full_name" binding:"required"`
	Email    string  `json:"email" binding:"required,email"`
	Phone    string  `json:"phone"`
	RoleID   string  `json:"role_id" binding:"required,uuid"`
	BranchID *string `json:"branch_id"`
}

type AcceptInvitationRequest struct {
	Token           string `json:"token" binding:"required"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
}

type UpdateUserRequest struct {
	FullName     string  `json:"full_name"`
	Phone        string  `json:"phone"`
	RoleID       *string `json:"role_id"`
	BranchID     *string `json:"branch_id"`
	AvatarFileID *string `json:"avatar_file_id"`
}

type UpdateUserStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active inactive suspended invited"`
}

type UserResponse struct {
	ID             string     `json:"id"`
	AppwriteUserID string     `json:"appwrite_user_id"`
	BusinessID     string     `json:"business_id"`
	BranchID       *string    `json:"branch_id"`
	RoleID         string     `json:"role_id"`
	RoleName       string     `json:"role_name"`
	FullName       string     `json:"full_name"`
	Email          string     `json:"email"`
	Phone          string     `json:"phone"`
	AvatarFileID   string     `json:"avatar_file_id"`
	Status         string     `json:"status"`
	EmailVerified  bool       `json:"email_verified"`
	LastLoginAt    *time.Time `json:"last_login_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type InviteUserResponse struct {
	User              UserResponse `json:"user"`
	TemporaryPassword string       `json:"temporary_password,omitempty"`
	Message           string       `json:"message"`
}

type InvitationResponse struct {
	ID         string     `json:"id"`
	BusinessID string     `json:"business_id"`
	BranchID   *string    `json:"branch_id"`
	RoleID     string     `json:"role_id"`
	FullName   string     `json:"full_name"`
	Email      string     `json:"email"`
	Phone      string     `json:"phone"`
	Status     string     `json:"status"`
	ExpiresAt  time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	Token      string     `json:"token,omitempty"`
}

type InvitationActionResponse struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
	Token     string    `json:"token,omitempty"`
}

type AcceptInvitationResponse struct {
	UserID         string  `json:"user_id"`
	AppwriteUserID string  `json:"appwrite_user_id"`
	BusinessID     string  `json:"business_id"`
	BranchID       *string `json:"branch_id"`
	RoleID         string  `json:"role_id"`
	Status         string  `json:"status"`
}

type DeleteUserResponse struct {
	ID        string     `json:"id"`
	Status    string     `json:"status"`
	DeletedAt *time.Time `json:"deleted_at"`
}

type AssignBranchRequest struct {
	BranchID *string `json:"branch_id" binding:"required"`
}

type UserActivityResponse struct {
	ID          string    `json:"id"`
	ModuleName  string    `json:"module_name"`
	ActionType  string    `json:"action_type"`
	ReferenceID string    `json:"reference_id"`
	IPAddress   string    `json:"ip_address"`
	UserAgent   string    `json:"user_agent"`
	CreatedAt   time.Time `json:"created_at"`
}
