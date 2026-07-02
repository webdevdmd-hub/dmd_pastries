package accounting

import "time"

type ChartAccountListQuery struct {
	Search          string
	AccountType     string
	AccountGroup    string
	Status          string
	ParentAccountID string
	Page            int
	Limit           int
	SortBy          string
	SortOrder       string
}

type PaymentAccountListQuery struct {
	Search      string
	BranchID    string
	AccountType string
	Status      string
	Page        int
	Limit       int
	SortBy      string
	SortOrder   string
}

type SeedPaymentAccountsResponse struct {
	CreatedPaymentAccounts int `json:"created_payment_accounts"`
	LinkedPaymentMethods   int `json:"linked_payment_methods"`
}

type AccountTransferListQuery struct {
	BranchID         string
	PaymentAccountID string
	DateFrom         string
	DateTo           string
	Page             int
	Limit            int
	SortOrder        string
}

type PlatformSettlementListQuery struct {
	BranchID                 string
	PlatformPaymentAccountID string
	DepositPaymentAccountID  string
	DateFrom                 string
	DateTo                   string
	Page                     int
	Limit                    int
	SortOrder                string
}

type UpdateAccountMappingsRequest struct {
	Mappings map[string]string `json:"mappings" binding:"required"`
}

type AccountingSettingsResponse struct {
	BusinessID               string    `json:"business_id"`
	FinancialYearStartMonth  int       `json:"financial_year_start_month"`
	FinancialYearStartDay    int       `json:"financial_year_start_day"`
	FinancialYearStartLabel  string    `json:"financial_year_start_label"`
	UsesDefaultFinancialYear bool      `json:"uses_default_financial_year"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

type PurchasingPostingIntegrityIssue struct {
	CheckKey string                 `json:"check_key"`
	Severity string                 `json:"severity"`
	Message  string                 `json:"message"`
	Count    int64                  `json:"count"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

type PurchasingPostingIntegrityResponse struct {
	Healthy   bool                              `json:"healthy"`
	Policy    string                            `json:"policy"`
	Issues    []PurchasingPostingIntegrityIssue `json:"issues"`
	CheckedAt time.Time                         `json:"checked_at"`
}

type UpdateAccountingSettingsRequest struct {
	FinancialYearStartMonth *int `json:"financial_year_start_month"`
	FinancialYearStartDay   *int `json:"financial_year_start_day"`
}

type CreateChartAccountRequest struct {
	ParentAccountID    *string `json:"parent_account_id" binding:"omitempty,uuid"`
	AccountCode        string  `json:"account_code" binding:"required"`
	AccountName        string  `json:"account_name" binding:"required"`
	AccountType        string  `json:"account_type" binding:"required"`
	AccountGroup       string  `json:"account_group" binding:"required"`
	NormalBalance      string  `json:"normal_balance" binding:"required"`
	Description        string  `json:"description"`
	IsControlAccount   bool    `json:"is_control_account"`
	AllowManualPosting *bool   `json:"allow_manual_posting"`
}

type CreatePaymentAccountRequest struct {
	BranchID       *string `json:"branch_id" binding:"omitempty,uuid"`
	AccountName    string  `json:"account_name" binding:"required"`
	AccountType    string  `json:"account_type" binding:"required"`
	ChartAccountID string  `json:"chart_account_id" binding:"required,uuid"`
	Description    string  `json:"description"`
	Status         string  `json:"status" binding:"omitempty,oneof=active inactive"`
}

type CreateAccountTransferRequest struct {
	BranchID             *string `json:"branch_id" binding:"omitempty,uuid"`
	TransferDate         string  `json:"transfer_date" binding:"required"`
	FromPaymentAccountID string  `json:"from_payment_account_id" binding:"required,uuid"`
	ToPaymentAccountID   string  `json:"to_payment_account_id" binding:"required,uuid"`
	Amount               float64 `json:"amount" binding:"required"`
	ReferenceNumber      string  `json:"reference_number"`
	Notes                string  `json:"notes"`
}

type PlatformSettlementDeductionRequest struct {
	ExpenseAccountID string  `json:"expense_account_id" binding:"required,uuid"`
	DeductionType    string  `json:"deduction_type" binding:"required"`
	Description      string  `json:"description"`
	Amount           float64 `json:"amount" binding:"required"`
}

type CreatePlatformSettlementRequest struct {
	BranchID                 *string                              `json:"branch_id" binding:"omitempty,uuid"`
	SettlementDate           string                               `json:"settlement_date" binding:"required"`
	PlatformPaymentAccountID string                               `json:"platform_payment_account_id" binding:"required,uuid"`
	DepositPaymentAccountID  string                               `json:"deposit_payment_account_id" binding:"required,uuid"`
	GrossAmount              float64                              `json:"gross_amount" binding:"required"`
	NetReceivedAmount        float64                              `json:"net_received_amount" binding:"required"`
	Deductions               []PlatformSettlementDeductionRequest `json:"deductions"`
	ReferenceNumber          string                               `json:"reference_number"`
	Notes                    string                               `json:"notes"`
}

type UpdateChartAccountRequest struct {
	ParentAccountID    *string `json:"parent_account_id" binding:"omitempty,uuid"`
	AccountName        *string `json:"account_name"`
	AccountGroup       *string `json:"account_group"`
	Description        *string `json:"description"`
	IsControlAccount   *bool   `json:"is_control_account"`
	AllowManualPosting *bool   `json:"allow_manual_posting"`
}

type UpdatePaymentAccountRequest struct {
	BranchID       *string `json:"branch_id" binding:"omitempty,uuid"`
	AccountName    *string `json:"account_name"`
	AccountType    *string `json:"account_type"`
	ChartAccountID *string `json:"chart_account_id" binding:"omitempty,uuid"`
	Description    *string `json:"description"`
	Status         *string `json:"status" binding:"omitempty,oneof=active inactive"`
}

type UpdateChartAccountStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type JournalEntryListQuery struct {
	Search        string
	BranchID      string
	Status        string
	SourceType    string
	JournalOrigin string
	DateFrom      string
	DateTo        string
	Page          int
	Limit         int
	SortBy        string
	SortOrder     string
}

type GeneralLedgerQuery struct {
	AccountID string
	BranchID  string
	DateFrom  string
	DateTo    string
	Page      int
	Limit     int
	SortOrder string
}

type LedgerDetailsQuery struct {
	BranchID  string
	DateFrom  string
	DateTo    string
	Page      int
	Limit     int
	SortOrder string
}

type TrialBalanceQuery struct {
	BranchID            string
	DateFrom            string
	DateTo              string
	IncludeZeroBalances bool
}

type ProfitLossQuery struct {
	BranchID string
	DateFrom string
	DateTo   string
}

type BalanceSheetQuery struct {
	BranchID string
	AsOfDate string
}

type CreateJournalEntryRequest struct {
	BranchID        *string                   `json:"branch_id" binding:"omitempty,uuid"`
	EntryDate       string                    `json:"entry_date" binding:"required"`
	ReferenceNumber string                    `json:"reference_number"`
	SourceType      string                    `json:"source_type"`
	SourceID        *string                   `json:"source_id" binding:"omitempty,uuid"`
	Narration       string                    `json:"narration"`
	Lines           []JournalEntryLineRequest `json:"lines" binding:"required"`
}

type UpdateJournalEntryRequest struct {
	BranchID        *string                   `json:"branch_id" binding:"omitempty,uuid"`
	EntryDate       *string                   `json:"entry_date"`
	ReferenceNumber *string                   `json:"reference_number"`
	SourceType      *string                   `json:"source_type"`
	SourceID        *string                   `json:"source_id" binding:"omitempty,uuid"`
	Narration       *string                   `json:"narration"`
	Lines           []JournalEntryLineRequest `json:"lines"`
}

type JournalEntryLineRequest struct {
	AccountID    string  `json:"account_id" binding:"required,uuid"`
	DebitAmount  float64 `json:"debit_amount"`
	CreditAmount float64 `json:"credit_amount"`
	Description  string  `json:"description"`
}

type ReverseJournalEntryRequest struct {
	EntryDate       string `json:"entry_date"`
	ReferenceNumber string `json:"reference_number"`
	Narration       string `json:"narration"`
}

type ChartAccountResponse struct {
	ID                 string    `json:"id"`
	BusinessID         string    `json:"business_id"`
	ParentAccountID    *string   `json:"parent_account_id"`
	ParentAccountName  string    `json:"parent_account_name"`
	AccountCode        string    `json:"account_code"`
	AccountName        string    `json:"account_name"`
	AccountType        string    `json:"account_type"`
	AccountGroup       string    `json:"account_group"`
	NormalBalance      string    `json:"normal_balance"`
	Description        string    `json:"description"`
	IsSystemAccount    bool      `json:"is_system_account"`
	IsControlAccount   bool      `json:"is_control_account"`
	AllowManualPosting bool      `json:"allow_manual_posting"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type AccountMappingResponse struct {
	ID               string    `json:"id"`
	BusinessID       string    `json:"business_id"`
	MappingKey       string    `json:"mapping_key"`
	ChartAccountID   string    `json:"chart_account_id"`
	ChartAccountCode string    `json:"chart_account_code"`
	ChartAccountName string    `json:"chart_account_name"`
	ChartAccountType string    `json:"chart_account_type"`
	AccountGroup     string    `json:"account_group"`
	Description      string    `json:"description"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type PaymentAccountResponse struct {
	ID                             string    `json:"id"`
	BusinessID                     string    `json:"business_id"`
	BranchID                       *string   `json:"branch_id"`
	BranchName                     string    `json:"branch_name"`
	AccountName                    string    `json:"account_name"`
	AccountType                    string    `json:"account_type"`
	ChartAccountID                 string    `json:"chart_account_id"`
	ChartAccountCode               string    `json:"chart_account_code"`
	ChartAccountName               string    `json:"chart_account_name"`
	ChartAccountType               string    `json:"chart_account_type"`
	ChartAccountAllowManualPosting bool      `json:"chart_account_allow_manual_posting"`
	Description                    string    `json:"description"`
	CurrentBalance                 float64   `json:"current_balance"`
	BalanceLabel                   string    `json:"balance_label"`
	Status                         string    `json:"status"`
	CreatedAt                      time.Time `json:"created_at"`
	UpdatedAt                      time.Time `json:"updated_at"`
}

type AccountTransferResponse struct {
	ID                     string    `json:"id"`
	BusinessID             string    `json:"business_id"`
	BranchID               *string   `json:"branch_id"`
	BranchName             string    `json:"branch_name"`
	TransferNumber         string    `json:"transfer_number"`
	TransferDate           string    `json:"transfer_date"`
	FromPaymentAccountID   string    `json:"from_payment_account_id"`
	FromPaymentAccountName string    `json:"from_payment_account_name"`
	ToPaymentAccountID     string    `json:"to_payment_account_id"`
	ToPaymentAccountName   string    `json:"to_payment_account_name"`
	Amount                 float64   `json:"amount"`
	ReferenceNumber        string    `json:"reference_number"`
	Notes                  string    `json:"notes"`
	Status                 string    `json:"status"`
	JournalEntryID         *string   `json:"journal_entry_id"`
	CreatedByUserID        string    `json:"created_by_user_id"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type PlatformSettlementDeductionResponse struct {
	ID                 string  `json:"id"`
	ExpenseAccountID   string  `json:"expense_account_id"`
	ExpenseAccountCode string  `json:"expense_account_code"`
	ExpenseAccountName string  `json:"expense_account_name"`
	DeductionType      string  `json:"deduction_type"`
	Description        string  `json:"description"`
	Amount             float64 `json:"amount"`
}

type PlatformSettlementResponse struct {
	ID                         string                                `json:"id"`
	BusinessID                 string                                `json:"business_id"`
	BranchID                   *string                               `json:"branch_id"`
	BranchName                 string                                `json:"branch_name"`
	SettlementNumber           string                                `json:"settlement_number"`
	SettlementDate             string                                `json:"settlement_date"`
	PlatformPaymentAccountID   string                                `json:"platform_payment_account_id"`
	PlatformPaymentAccountName string                                `json:"platform_payment_account_name"`
	DepositPaymentAccountID    string                                `json:"deposit_payment_account_id"`
	DepositPaymentAccountName  string                                `json:"deposit_payment_account_name"`
	GrossAmount                float64                               `json:"gross_amount"`
	DeductionsTotal            float64                               `json:"deductions_total"`
	NetReceivedAmount          float64                               `json:"net_received_amount"`
	Deductions                 []PlatformSettlementDeductionResponse `json:"deductions"`
	ReferenceNumber            string                                `json:"reference_number"`
	Notes                      string                                `json:"notes"`
	Status                     string                                `json:"status"`
	JournalEntryID             *string                               `json:"journal_entry_id"`
	CreatedByUserID            string                                `json:"created_by_user_id"`
	CreatedAt                  time.Time                             `json:"created_at"`
	UpdatedAt                  time.Time                             `json:"updated_at"`
}

type JournalEntryResponse struct {
	ID               string                     `json:"id"`
	BusinessID       string                     `json:"business_id"`
	BranchID         *string                    `json:"branch_id"`
	BranchName       string                     `json:"branch_name"`
	EntryNumber      string                     `json:"entry_number"`
	EntryDate        string                     `json:"entry_date"`
	ReferenceNumber  string                     `json:"reference_number"`
	SourceType       string                     `json:"source_type"`
	SourceID         *string                    `json:"source_id"`
	Narration        string                     `json:"narration"`
	Status           string                     `json:"status"`
	TotalDebit       float64                    `json:"total_debit"`
	TotalCredit      float64                    `json:"total_credit"`
	PostedAt         *time.Time                 `json:"posted_at"`
	PostedByUserID   *string                    `json:"posted_by_user_id"`
	ReversedEntryID  *string                    `json:"reversed_entry_id"`
	ReversedAt       *time.Time                 `json:"reversed_at"`
	ReversedByUserID *string                    `json:"reversed_by_user_id"`
	CreatedByUserID  string                     `json:"created_by_user_id"`
	UpdatedByUserID  *string                    `json:"updated_by_user_id"`
	Lines            []JournalEntryLineResponse `json:"lines,omitempty"`
	CreatedAt        time.Time                  `json:"created_at"`
	UpdatedAt        time.Time                  `json:"updated_at"`
}

type JournalEntryLineResponse struct {
	ID             string    `json:"id"`
	JournalEntryID string    `json:"journal_entry_id"`
	AccountID      string    `json:"account_id"`
	AccountCode    string    `json:"account_code"`
	AccountName    string    `json:"account_name"`
	AccountType    string    `json:"account_type"`
	LineNumber     int       `json:"line_number"`
	DebitAmount    float64   `json:"debit_amount"`
	CreditAmount   float64   `json:"credit_amount"`
	Description    string    `json:"description"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type GeneralLedgerAccountResponse struct {
	AccountID     string `json:"account_id"`
	AccountCode   string `json:"account_code"`
	AccountName   string `json:"account_name"`
	AccountType   string `json:"account_type"`
	NormalBalance string `json:"normal_balance"`
}

type GeneralLedgerRowResponse struct {
	EntryID         string  `json:"entry_id"`
	EntryNumber     string  `json:"entry_number"`
	EntryDate       string  `json:"entry_date"`
	BranchID        *string `json:"branch_id"`
	BranchName      string  `json:"branch_name"`
	AccountID       string  `json:"account_id"`
	AccountCode     string  `json:"account_code"`
	AccountName     string  `json:"account_name"`
	AccountType     string  `json:"account_type"`
	NormalBalance   string  `json:"normal_balance"`
	ReferenceNumber string  `json:"reference_number"`
	Narration       string  `json:"narration"`
	LineDescription string  `json:"line_description"`
	SourceType      string  `json:"source_type"`
	SourceID        *string `json:"source_id"`
	DebitAmount     float64 `json:"debit_amount"`
	CreditAmount    float64 `json:"credit_amount"`
	RunningBalance  float64 `json:"running_balance"`
}

type GeneralLedgerResponse struct {
	Account        *GeneralLedgerAccountResponse `json:"account"`
	OpeningBalance float64                       `json:"opening_balance"`
	PeriodDebit    float64                       `json:"period_debit"`
	PeriodCredit   float64                       `json:"period_credit"`
	ClosingBalance float64                       `json:"closing_balance"`
	Items          []GeneralLedgerRowResponse    `json:"items"`
	Pagination     PaginationResponse            `json:"pagination"`
}

type LedgerDetailsSummaryResponse struct {
	OpeningBalance float64 `json:"opening_balance"`
	PeriodDebit    float64 `json:"period_debit"`
	PeriodCredit   float64 `json:"period_credit"`
	ClosingBalance float64 `json:"closing_balance"`
	BalanceLabel   string  `json:"balance_label"`
}

type LedgerDetailsResponse struct {
	Account      ChartAccountResponse         `json:"account"`
	Summary      LedgerDetailsSummaryResponse `json:"summary"`
	Transactions []GeneralLedgerRowResponse   `json:"transactions"`
	Pagination   PaginationResponse           `json:"pagination"`
}

type TrialBalanceRowResponse struct {
	AccountID      string  `json:"account_id"`
	AccountCode    string  `json:"account_code"`
	AccountName    string  `json:"account_name"`
	AccountType    string  `json:"account_type"`
	AccountGroup   string  `json:"account_group"`
	NormalBalance  string  `json:"normal_balance"`
	OpeningBalance float64 `json:"opening_balance"`
	PeriodDebit    float64 `json:"period_debit"`
	PeriodCredit   float64 `json:"period_credit"`
	ClosingDebit   float64 `json:"closing_debit"`
	ClosingCredit  float64 `json:"closing_credit"`
}

type TrialBalanceResponse struct {
	DateFrom    string                    `json:"date_from"`
	DateTo      string                    `json:"date_to"`
	TotalDebit  float64                   `json:"total_debit"`
	TotalCredit float64                   `json:"total_credit"`
	IsBalanced  bool                      `json:"is_balanced"`
	Items       []TrialBalanceRowResponse `json:"items"`
}

type ProfitLossAccountRowResponse struct {
	AccountID    string  `json:"account_id"`
	AccountCode  string  `json:"account_code"`
	AccountName  string  `json:"account_name"`
	AccountType  string  `json:"account_type"`
	AccountGroup string  `json:"account_group"`
	Amount       float64 `json:"amount"`
}

type ProfitLossSectionResponse struct {
	Total float64                        `json:"total"`
	Items []ProfitLossAccountRowResponse `json:"items"`
}

type ProfitLossResponse struct {
	DateFrom          string                    `json:"date_from"`
	DateTo            string                    `json:"date_to"`
	Income            ProfitLossSectionResponse `json:"income"`
	COGS              ProfitLossSectionResponse `json:"cogs"`
	GrossProfit       float64                   `json:"gross_profit"`
	OperatingExpenses ProfitLossSectionResponse `json:"operating_expenses"`
	TotalExpenses     float64                   `json:"total_expenses"`
	NetProfit         float64                   `json:"net_profit"`
}

type BalanceSheetAccountRowResponse struct {
	AccountID    string  `json:"account_id"`
	AccountCode  string  `json:"account_code"`
	AccountName  string  `json:"account_name"`
	AccountType  string  `json:"account_type"`
	AccountGroup string  `json:"account_group"`
	Amount       float64 `json:"amount"`
	IsCalculated bool    `json:"is_calculated,omitempty"`
}

type BalanceSheetSectionResponse struct {
	Total float64                          `json:"total"`
	Items []BalanceSheetAccountRowResponse `json:"items"`
}

type BalanceSheetResponse struct {
	AsOfDate                  string                      `json:"as_of_date"`
	FinancialYearStartDate    string                      `json:"financial_year_start_date"`
	Assets                    BalanceSheetSectionResponse `json:"assets"`
	Liabilities               BalanceSheetSectionResponse `json:"liabilities"`
	Equity                    BalanceSheetSectionResponse `json:"equity"`
	TotalAssets               float64                     `json:"total_assets"`
	TotalLiabilities          float64                     `json:"total_liabilities"`
	TotalEquity               float64                     `json:"total_equity"`
	TotalLiabilitiesAndEquity float64                     `json:"total_liabilities_and_equity"`
	IsBalanced                bool                        `json:"is_balanced"`
	Difference                float64                     `json:"difference"`
}

type BackfillJournalsRequest struct {
	Targets  []string `json:"targets"`
	BranchID string   `json:"branch_id"`
	DateFrom string   `json:"date_from"`
	DateTo   string   `json:"date_to"`
	Limit    int      `json:"limit"`
	DryRun   bool     `json:"dry_run"`
}

type BackfillTargetResult struct {
	Target    string   `json:"target"`
	Scanned   int      `json:"scanned"`
	WouldPost int      `json:"would_post"`
	Posted    int      `json:"posted"`
	Skipped   int      `json:"skipped"`
	Failed    int      `json:"failed"`
	Errors    []string `json:"errors,omitempty"`
}

type BackfillJournalsResponse struct {
	DryRun    bool                   `json:"dry_run"`
	DateFrom  string                 `json:"date_from,omitempty"`
	DateTo    string                 `json:"date_to,omitempty"`
	BranchID  string                 `json:"branch_id,omitempty"`
	Limit     int                    `json:"limit"`
	Results   []BackfillTargetResult `json:"results"`
	StartedAt time.Time              `json:"started_at"`
	EndedAt   time.Time              `json:"ended_at"`
}

type BackfillReadinessQuery struct {
	BranchID string
	DateFrom string
	DateTo   string
}

type BackfillReadinessIssue struct {
	Severity string                 `json:"severity"`
	CheckKey string                 `json:"check_key"`
	Message  string                 `json:"message"`
	Details  map[string]interface{} `json:"details,omitempty"`
}

type BackfillReadinessTarget struct {
	Target         string `json:"target"`
	CandidateCount int64  `json:"candidate_count"`
}

type BackfillReadinessResponse struct {
	Ready     bool                      `json:"ready"`
	BranchID  string                    `json:"branch_id,omitempty"`
	DateFrom  string                    `json:"date_from,omitempty"`
	DateTo    string                    `json:"date_to,omitempty"`
	Targets   []BackfillReadinessTarget `json:"targets"`
	Issues    []BackfillReadinessIssue  `json:"issues"`
	CheckedAt time.Time                 `json:"checked_at"`
}

type ReconciliationQuery struct {
	BranchID string
	AsOfDate string
}

type ReconciliationCheckResponse struct {
	CheckKey          string  `json:"check_key"`
	Label             string  `json:"label"`
	OperationalAmount float64 `json:"operational_amount"`
	LedgerAmount      float64 `json:"ledger_amount"`
	Difference        float64 `json:"difference"`
	IsMatched         bool    `json:"is_matched"`
	Status            string  `json:"status"`
	Notes             string  `json:"notes,omitempty"`
}

type ReconciliationHealthResponse struct {
	AsOfDate        string                        `json:"as_of_date"`
	BranchID        string                        `json:"branch_id,omitempty"`
	IsHealthy       bool                          `json:"is_healthy"`
	TrialBalance    ReconciliationCheckResponse   `json:"trial_balance"`
	BalanceSheet    ReconciliationCheckResponse   `json:"balance_sheet"`
	Checks          []ReconciliationCheckResponse `json:"checks"`
	UnmatchedChecks int                           `json:"unmatched_checks"`
}

type PaymentAccountReconciliationItem struct {
	PaymentAccountID   string  `json:"payment_account_id"`
	PaymentAccountName string  `json:"payment_account_name"`
	AccountType        string  `json:"account_type"`
	BranchID           *string `json:"branch_id"`
	BranchName         string  `json:"branch_name"`
	ChartAccountID     string  `json:"chart_account_id"`
	ChartAccountCode   string  `json:"chart_account_code"`
	ChartAccountName   string  `json:"chart_account_name"`
	LedgerAmount       float64 `json:"ledger_amount"`
	Status             string  `json:"status"`
	Notes              string  `json:"notes,omitempty"`
}

type PaymentAccountReconciliationResponse struct {
	AsOfDate string                             `json:"as_of_date"`
	BranchID string                             `json:"branch_id,omitempty"`
	Items    []PaymentAccountReconciliationItem `json:"items"`
}

type PaginatedResponse[T any] struct {
	Items      []T                `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
