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

type UpdateChartAccountRequest struct {
	ParentAccountID    *string `json:"parent_account_id" binding:"omitempty,uuid"`
	AccountName        *string `json:"account_name"`
	AccountGroup       *string `json:"account_group"`
	Description        *string `json:"description"`
	IsControlAccount   *bool   `json:"is_control_account"`
	AllowManualPosting *bool   `json:"allow_manual_posting"`
}

type UpdateChartAccountStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type JournalEntryListQuery struct {
	Search     string
	BranchID   string
	Status     string
	SourceType string
	DateFrom   string
	DateTo     string
	Page       int
	Limit      int
	SortBy     string
	SortOrder  string
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
}

type BalanceSheetSectionResponse struct {
	Total float64                          `json:"total"`
	Items []BalanceSheetAccountRowResponse `json:"items"`
}

type BalanceSheetResponse struct {
	AsOfDate                  string                      `json:"as_of_date"`
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
