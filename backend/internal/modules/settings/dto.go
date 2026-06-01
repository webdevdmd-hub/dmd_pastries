package settings

import (
	"encoding/json"
	"time"
)

type CompanySettingsResponse struct {
	ID                  string    `json:"id"`
	BusinessID          string    `json:"business_id"`
	BusinessDisplayName string    `json:"business_display_name"`
	LogoFileID          string    `json:"logo_file_id"`
	Address             string    `json:"address"`
	Phone               string    `json:"phone"`
	Email               string    `json:"email"`
	Website             string    `json:"website"`
	VATNumber           string    `json:"vat_number"`
	Currency            string    `json:"currency"`
	Timezone            string    `json:"timezone"`
	InvoiceFooter       string    `json:"invoice_footer"`
	ReceiptFooter       string    `json:"receipt_footer"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type UpdateCompanySettingsRequest struct {
	BusinessDisplayName string `json:"business_display_name"`
	LogoFileID          string `json:"logo_file_id"`
	Address             string `json:"address"`
	Phone               string `json:"phone"`
	Email               string `json:"email" binding:"omitempty,email"`
	Website             string `json:"website"`
	VATNumber           string `json:"vat_number"`
	Currency            string `json:"currency"`
	Timezone            string `json:"timezone"`
	InvoiceFooter       string `json:"invoice_footer"`
	ReceiptFooter       string `json:"receipt_footer"`
}

type SettingsOverviewResponse struct {
	CompanyProfileCompleted   bool   `json:"company_profile_completed"`
	BranchCount               int64  `json:"branch_count"`
	ActiveTaxRatesCount       int64  `json:"active_tax_rates_count"`
	ActivePaymentMethodsCount int64  `json:"active_payment_methods_count"`
	DefaultCurrency           string `json:"default_currency"`
	DefaultTimezone           string `json:"default_timezone"`
}

type CreateTaxRateRequest struct {
	TaxName        string  `json:"tax_name" binding:"required"`
	TaxType        string  `json:"tax_type" binding:"required"`
	RatePercentage float64 `json:"rate_percentage"`
	IsInclusive    bool    `json:"is_inclusive"`
	Country        string  `json:"country"`
	Region         string  `json:"region"`
	IsDefault      bool    `json:"is_default"`
}

type UpdateTaxRateRequest struct {
	TaxName        string   `json:"tax_name"`
	TaxType        string   `json:"tax_type"`
	RatePercentage *float64 `json:"rate_percentage"`
	IsInclusive    *bool    `json:"is_inclusive"`
	Country        string   `json:"country"`
	Region         string   `json:"region"`
	IsDefault      *bool    `json:"is_default"`
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active inactive"`
}

type TaxRateResponse struct {
	ID             string    `json:"id"`
	BusinessID     string    `json:"business_id"`
	TaxName        string    `json:"tax_name"`
	TaxType        string    `json:"tax_type"`
	RatePercentage float64   `json:"rate_percentage"`
	IsInclusive    bool      `json:"is_inclusive"`
	Country        string    `json:"country"`
	Region         string    `json:"region"`
	IsDefault      bool      `json:"is_default"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreatePaymentMethodRequest struct {
	MethodName                string  `json:"method_name" binding:"required"`
	MethodType                string  `json:"method_type" binding:"required"`
	IsDefault                 bool    `json:"is_default"`
	AllowSplitPayment         bool    `json:"allow_split_payment"`
	RequiresReference         bool    `json:"requires_reference"`
	ShowInPOS                 *bool   `json:"show_in_pos"`
	ShowInBakeryOrders        *bool   `json:"show_in_bakery_orders"`
	ShowInPurchasing          *bool   `json:"show_in_purchasing"`
	ShowInExpenses            *bool   `json:"show_in_expenses"`
	ShowInDashboardCollection *bool   `json:"show_in_dashboard_collection"`
	DefaultPaymentAccountID   *string `json:"default_payment_account_id"`
}

type UpdatePaymentMethodRequest struct {
	MethodName                string  `json:"method_name"`
	MethodType                string  `json:"method_type"`
	IsDefault                 *bool   `json:"is_default"`
	AllowSplitPayment         *bool   `json:"allow_split_payment"`
	RequiresReference         *bool   `json:"requires_reference"`
	ShowInPOS                 *bool   `json:"show_in_pos"`
	ShowInBakeryOrders        *bool   `json:"show_in_bakery_orders"`
	ShowInPurchasing          *bool   `json:"show_in_purchasing"`
	ShowInExpenses            *bool   `json:"show_in_expenses"`
	ShowInDashboardCollection *bool   `json:"show_in_dashboard_collection"`
	DefaultPaymentAccountID   *string `json:"default_payment_account_id"`
}

type PaymentMethodResponse struct {
	ID                        string    `json:"id"`
	BusinessID                string    `json:"business_id"`
	MethodName                string    `json:"method_name"`
	MethodType                string    `json:"method_type"`
	IsDefault                 bool      `json:"is_default"`
	AllowSplitPayment         bool      `json:"allow_split_payment"`
	RequiresReference         bool      `json:"requires_reference"`
	ShowInPOS                 bool      `json:"show_in_pos"`
	ShowInBakeryOrders        bool      `json:"show_in_bakery_orders"`
	ShowInPurchasing          bool      `json:"show_in_purchasing"`
	ShowInExpenses            bool      `json:"show_in_expenses"`
	ShowInDashboardCollection bool      `json:"show_in_dashboard_collection"`
	DefaultPaymentAccountID   *string   `json:"default_payment_account_id"`
	DefaultPaymentAccountName string    `json:"default_payment_account_name"`
	Status                    string    `json:"status"`
	CreatedAt                 time.Time `json:"created_at"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

type CreateSalesChannelRequest struct {
	ChannelName                 string   `json:"channel_name" binding:"required"`
	ChannelType                 string   `json:"channel_type" binding:"required"`
	RequiresExternalOrderNumber bool     `json:"requires_external_order_number"`
	DefaultPaymentMethodID      *string  `json:"default_payment_method_id"`
	CommissionRate              *float64 `json:"commission_rate"`
	IsDefault                   bool     `json:"is_default"`
	Status                      string   `json:"status"`
}

type UpdateSalesChannelRequest struct {
	ChannelName                 string   `json:"channel_name"`
	ChannelType                 string   `json:"channel_type"`
	RequiresExternalOrderNumber *bool    `json:"requires_external_order_number"`
	DefaultPaymentMethodID      *string  `json:"default_payment_method_id"`
	CommissionRate              *float64 `json:"commission_rate"`
	IsDefault                   *bool    `json:"is_default"`
	Status                      string   `json:"status" binding:"omitempty,oneof=active inactive"`
}

type SalesChannelResponse struct {
	ID                          string    `json:"id"`
	BusinessID                  string    `json:"business_id"`
	ChannelName                 string    `json:"channel_name"`
	ChannelType                 string    `json:"channel_type"`
	RequiresExternalOrderNumber bool      `json:"requires_external_order_number"`
	DefaultPaymentMethodID      *string   `json:"default_payment_method_id"`
	DefaultPaymentMethodName    string    `json:"default_payment_method_name"`
	CommissionRate              *float64  `json:"commission_rate"`
	IsDefault                   bool      `json:"is_default"`
	Status                      string    `json:"status"`
	CreatedAt                   time.Time `json:"created_at"`
	UpdatedAt                   time.Time `json:"updated_at"`
}

type CreateReceiptLayoutRequest struct {
	BranchID     *string         `json:"branch_id"`
	LayoutName   string          `json:"layout_name" binding:"required"`
	ReceiptType  string          `json:"receipt_type" binding:"required,oneof=58mm 80mm a4 custom"`
	PrinterType  string          `json:"printer_type"`
	CounterID    string          `json:"counter_id"`
	IsDefault    bool            `json:"is_default"`
	Status       string          `json:"status"`
	LayoutConfig json.RawMessage `json:"layout_config" binding:"required"`
}

type UpdateReceiptLayoutRequest struct {
	BranchID     *string          `json:"branch_id"`
	LayoutName   string           `json:"layout_name"`
	ReceiptType  string           `json:"receipt_type" binding:"omitempty,oneof=58mm 80mm a4 custom"`
	PrinterType  *string          `json:"printer_type"`
	CounterID    *string          `json:"counter_id"`
	IsDefault    *bool            `json:"is_default"`
	Status       string           `json:"status" binding:"omitempty,oneof=active inactive"`
	LayoutConfig *json.RawMessage `json:"layout_config"`
}

type ReceiptLayoutResponse struct {
	ID           string          `json:"id"`
	BusinessID   string          `json:"business_id"`
	BranchID     *string         `json:"branch_id"`
	LayoutName   string          `json:"layout_name"`
	ReceiptType  string          `json:"receipt_type"`
	PrinterType  string          `json:"printer_type"`
	CounterID    string          `json:"counter_id"`
	IsDefault    bool            `json:"is_default"`
	Status       string          `json:"status"`
	LayoutConfig json.RawMessage `json:"layout_config"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

type ReceiptLayoutPreviewRequest struct {
	SaleID     string                 `json:"sale_id"`
	SampleData map[string]interface{} `json:"sample_data"`
}

type ReceiptLayoutPreviewResponse struct {
	Layout      ReceiptLayoutResponse  `json:"layout"`
	PreviewData map[string]interface{} `json:"preview_data"`
}
