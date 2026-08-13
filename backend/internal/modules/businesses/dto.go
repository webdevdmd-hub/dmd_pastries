package businesses

import "time"

type BusinessResponse struct {
	ID           string    `json:"id"`
	BusinessName string    `json:"business_name"`
	OwnerUserID  *string   `json:"owner_user_id"`
	Currency     string    `json:"currency"`
	Timezone     string    `json:"timezone"`
	VATNumber    string    `json:"vat_number"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UpdateBusinessRequest struct {
	BusinessName string `json:"business_name"`
	Currency     string `json:"currency"`
	Timezone     string `json:"timezone"`
	VATNumber    string `json:"vat_number"`
	Status       string `json:"status" binding:"omitempty,oneof=active inactive suspended"`
}

type BusinessSettingsResponse struct {
	ID                 string    `json:"id"`
	BusinessID         string    `json:"business_id"`
	ReceiptFooter      string    `json:"receipt_footer"`
	AllowNegativeStock bool      `json:"allow_negative_stock"`
	DefaultTaxRate     float64   `json:"default_tax_rate"`
	PriceIncludesTax   bool      `json:"price_includes_tax"`
	DefaultTaxMode     string    `json:"default_tax_mode"`
	LowStockAlert      bool      `json:"low_stock_alert"`
	DefaultLanguage    string    `json:"default_language"`
	DateFormat         string    `json:"date_format"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type UpdateBusinessSettingsRequest struct {
	ReceiptFooter      *string  `json:"receipt_footer"`
	AllowNegativeStock *bool    `json:"allow_negative_stock"`
	DefaultTaxRate     *float64 `json:"default_tax_rate"`
	PriceIncludesTax   *bool    `json:"price_includes_tax"`
	DefaultTaxMode     *string  `json:"default_tax_mode"`
	LowStockAlert      *bool    `json:"low_stock_alert"`
	DefaultLanguage    *string  `json:"default_language"`
	DateFormat         *string  `json:"date_format"`
}

type OnboardingStepResponse struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Complete bool   `json:"complete"`
	Required bool   `json:"required"`
}

type OnboardingStatusResponse struct {
	BusinessID        string                   `json:"business_id"`
	Complete          bool                     `json:"complete"`
	CompletionPercent int                      `json:"completion_percent"`
	CurrentBranchID   *string                  `json:"current_branch_id"`
	Steps             []OnboardingStepResponse `json:"steps"`
}

type SwitchBranchRequest struct {
	BranchID string `json:"branch_id" binding:"required,uuid"`
}

type SwitchBranchResponse struct {
	UserID          string `json:"user_id"`
	BusinessID      string `json:"business_id"`
	CurrentBranchID string `json:"current_branch_id"`
}
