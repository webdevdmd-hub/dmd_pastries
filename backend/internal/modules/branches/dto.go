package branches

import "time"

type CreateBranchRequest struct {
	BranchName    string  `json:"branch_name"`
	Name          string  `json:"name" binding:"required"`
	Code          string  `json:"code"`
	BranchCode    string  `json:"branch_code"`
	Address       string  `json:"address"`
	Phone         string  `json:"phone"`
	Email         string  `json:"email" binding:"omitempty,email"`
	ManagerUserID *string `json:"manager_user_id" binding:"omitempty,uuid"`
	AddressLine1  string  `json:"address_line_1"`
	AddressLine2  string  `json:"address_line_2"`
	City          string  `json:"city"`
	Country       string  `json:"country"`
	Timezone      string  `json:"timezone"`
	IsDefault     bool    `json:"is_default"`
	Status        string  `json:"status" binding:"omitempty,oneof=active inactive"`
}

type UpdateBranchRequest struct {
	BranchName    string  `json:"branch_name"`
	Name          string  `json:"name"`
	Code          string  `json:"code"`
	BranchCode    string  `json:"branch_code"`
	Address       string  `json:"address"`
	Phone         string  `json:"phone"`
	Email         string  `json:"email" binding:"omitempty,email"`
	ManagerUserID *string `json:"manager_user_id" binding:"omitempty,uuid"`
	AddressLine1  string  `json:"address_line_1"`
	AddressLine2  string  `json:"address_line_2"`
	City          string  `json:"city"`
	Country       string  `json:"country"`
	Timezone      string  `json:"timezone"`
	IsDefault     *bool   `json:"is_default"`
	Status        string  `json:"status" binding:"omitempty,oneof=active inactive"`
}

type UpdateBranchStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active inactive"`
}

type BranchResponse struct {
	ID            string    `json:"id"`
	BusinessID    string    `json:"business_id"`
	Name          string    `json:"name"`
	Code          string    `json:"code"`
	BranchCode    string    `json:"branch_code"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	ManagerUserID *string   `json:"manager_user_id"`
	AddressLine1  string    `json:"address_line_1"`
	AddressLine2  string    `json:"address_line_2"`
	City          string    `json:"city"`
	Country       string    `json:"country"`
	Timezone      string    `json:"timezone"`
	IsDefault     bool      `json:"is_default"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
