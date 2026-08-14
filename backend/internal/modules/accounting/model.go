package accounting

import (
	"time"

	"gorm.io/gorm"
)

type ChartAccount struct {
	ID                 string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID         string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID           string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ParentAccountID    *string        `gorm:"type:uuid;index" json:"parent_account_id"`
	AccountCode        string         `gorm:"size:50;not null" json:"account_code"`
	AccountName        string         `gorm:"size:255;not null" json:"account_name"`
	AccountType        string         `gorm:"size:50;not null" json:"account_type"`
	AccountGroup       string         `gorm:"size:100;not null" json:"account_group"`
	NormalBalance      string         `gorm:"size:20;not null" json:"normal_balance"`
	Description        string         `json:"description"`
	IsSystemAccount    bool           `gorm:"not null;default:false" json:"is_system_account"`
	IsControlAccount   bool           `gorm:"not null;default:false" json:"is_control_account"`
	IsHeader           bool           `gorm:"not null;default:false" json:"is_header"`
	AllowManualPosting bool           `gorm:"not null;default:true" json:"allow_manual_posting"`
	Status             string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedByUserID    *string        `gorm:"type:uuid;index" json:"created_by_user_id"`
	UpdatedByUserID    *string        `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ChartAccount) TableName() string { return "chart_of_accounts" }

type AccountMapping struct {
	ID             string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID     string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID       string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	MappingKey     string         `gorm:"size:100;not null;index" json:"mapping_key"`
	ChartAccountID string         `gorm:"type:uuid;not null;index" json:"chart_account_id"`
	Description    string         `json:"description"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (AccountMapping) TableName() string { return "accounting_account_mappings" }

type PaymentAccount struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        *string        `gorm:"type:uuid;index" json:"branch_id"`
	AccountName     string         `gorm:"size:150;not null" json:"account_name"`
	AccountType     string         `gorm:"size:50;not null" json:"account_type"`
	ChartAccountID  string         `gorm:"type:uuid;not null;index" json:"chart_account_id"`
	Description     string         `json:"description"`
	Status          string         `gorm:"size:50;not null;default:active" json:"status"`
	CreatedByUserID *string        `gorm:"type:uuid;index" json:"created_by_user_id"`
	UpdatedByUserID *string        `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Opening balance (Phase 5 / W3): the account's real-world balance when
	// the business started keeping books here. Posted against 3400 Opening
	// Balance Equity; editing reposts.
	OpeningBalance        float64    `gorm:"type:numeric(14,2);not null;default:0" json:"opening_balance"`
	OpeningBalanceDate    *time.Time `gorm:"type:date" json:"opening_balance_date"`
	OpeningJournalEntryID *string    `gorm:"type:uuid" json:"opening_journal_entry_id"`
}

func (PaymentAccount) TableName() string { return "payment_accounts" }

// ChartAccountOpeningBalance is a go-live balance on any chart account
// (Phase 6 / W1). Payment accounts and inventory keep their own dedicated
// mechanisms; this covers everything else.
type ChartAccountOpeningBalance struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	ChartAccountID  string         `gorm:"type:uuid;not null;index" json:"chart_account_id"`
	Amount          float64        `gorm:"type:numeric(14,2);not null;default:0" json:"amount"`
	OpeningDate     time.Time      `gorm:"type:date;not null" json:"opening_date"`
	JournalEntryID  *string        `gorm:"type:uuid" json:"journal_entry_id"`
	CreatedByUserID *string        `gorm:"type:uuid" json:"created_by_user_id"`
	UpdatedByUserID *string        `gorm:"type:uuid" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ChartAccountOpeningBalance) TableName() string { return "chart_account_opening_balances" }

// CounterpartyOpeningBalance is the per-customer / per-supplier subledger
// behind the AR and AP control accounts. Journal lines cannot carry a party,
// so the control-account balance is attributed here, the same way
// customer_credits backs 2200 Customer Advance.
type CounterpartyOpeningBalance struct {
	ID         string `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID   string `gorm:"type:uuid;not null;index" json:"branch_id"`
	PartyType  string `gorm:"size:20;not null;index" json:"party_type"`
	PartyID    string `gorm:"type:uuid;not null;index" json:"party_id"`
	// Positive means the customer owes the business, or the business owes the
	// supplier. Negative mirrors the entry.
	Amount          float64        `gorm:"type:numeric(14,2);not null;default:0" json:"amount"`
	OpeningDate     time.Time      `gorm:"type:date;not null" json:"opening_date"`
	JournalEntryID  *string        `gorm:"type:uuid" json:"journal_entry_id"`
	CreatedByUserID *string        `gorm:"type:uuid" json:"created_by_user_id"`
	UpdatedByUserID *string        `gorm:"type:uuid" json:"updated_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (CounterpartyOpeningBalance) TableName() string { return "counterparty_opening_balances" }

const (
	PartyTypeCustomer = "customer"
	PartyTypeSupplier = "supplier"
)

type AccountTransfer struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID             *string        `gorm:"type:uuid;index" json:"branch_id"`
	TransferNumber       string         `gorm:"size:100;not null" json:"transfer_number"`
	TransferDate         time.Time      `gorm:"type:date;not null" json:"transfer_date"`
	FromPaymentAccountID string         `gorm:"type:uuid;not null;index" json:"from_payment_account_id"`
	ToPaymentAccountID   string         `gorm:"type:uuid;not null;index" json:"to_payment_account_id"`
	FromChartAccountID   string         `gorm:"type:uuid;not null;index" json:"from_chart_account_id"`
	ToChartAccountID     string         `gorm:"type:uuid;not null;index" json:"to_chart_account_id"`
	Amount               float64        `gorm:"not null;default:0" json:"amount"`
	ReferenceNumber      string         `gorm:"size:255" json:"reference_number"`
	Notes                string         `json:"notes"`
	Status               string         `gorm:"size:50;not null;default:completed" json:"status"`
	JournalEntryID       *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	CreatedByUserID      string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (AccountTransfer) TableName() string { return "account_transfers" }

type PlatformSettlement struct {
	ID                       string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID               string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID                 *string        `gorm:"type:uuid;index" json:"branch_id"`
	SettlementNumber         string         `gorm:"size:100;not null" json:"settlement_number"`
	SettlementDate           time.Time      `gorm:"type:date;not null" json:"settlement_date"`
	PlatformPaymentAccountID string         `gorm:"type:uuid;not null;index" json:"platform_payment_account_id"`
	DepositPaymentAccountID  string         `gorm:"type:uuid;not null;index" json:"deposit_payment_account_id"`
	PlatformChartAccountID   string         `gorm:"type:uuid;not null;index" json:"platform_chart_account_id"`
	DepositChartAccountID    string         `gorm:"type:uuid;not null;index" json:"deposit_chart_account_id"`
	GrossAmount              float64        `gorm:"not null;default:0" json:"gross_amount"`
	DeductionsTotal          float64        `gorm:"not null;default:0" json:"deductions_total"`
	NetReceivedAmount        float64        `gorm:"not null;default:0" json:"net_received_amount"`
	ReferenceNumber          string         `gorm:"size:255" json:"reference_number"`
	Notes                    string         `json:"notes"`
	Status                   string         `gorm:"size:50;not null;default:completed" json:"status"`
	JournalEntryID           *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	CreatedByUserID          string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	CreatedAt                time.Time      `json:"created_at"`
	UpdatedAt                time.Time      `json:"updated_at"`
	DeletedAt                gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PlatformSettlement) TableName() string { return "platform_settlements" }

type PlatformSettlementDeduction struct {
	ID                   string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID           string         `gorm:"type:uuid;not null;index" json:"business_id"`
	PlatformSettlementID string         `gorm:"type:uuid;not null;index" json:"platform_settlement_id"`
	ExpenseAccountID     string         `gorm:"type:uuid;not null;index" json:"expense_account_id"`
	DeductionType        string         `gorm:"size:100;not null" json:"deduction_type"`
	Description          string         `json:"description"`
	Amount               float64        `gorm:"not null;default:0" json:"amount"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (PlatformSettlementDeduction) TableName() string {
	return "platform_settlement_deductions"
}

type JournalEntry struct {
	ID               string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID         *string        `gorm:"type:uuid;index" json:"branch_id"`
	EntryNumber      string         `gorm:"size:100;not null" json:"entry_number"`
	EntryDate        time.Time      `gorm:"type:date;not null" json:"entry_date"`
	ReferenceNumber  string         `gorm:"size:255" json:"reference_number"`
	SourceType       string         `gorm:"size:100" json:"source_type"`
	SourceID         *string        `gorm:"type:uuid;index" json:"source_id"`
	Narration        string         `json:"narration"`
	Status           string         `gorm:"size:50;not null;default:draft" json:"status"`
	TotalDebit       float64        `gorm:"not null;default:0" json:"total_debit"`
	TotalCredit      float64        `gorm:"not null;default:0" json:"total_credit"`
	PostedAt         *time.Time     `json:"posted_at"`
	PostedByUserID   *string        `gorm:"type:uuid;index" json:"posted_by_user_id"`
	ReversedEntryID  *string        `gorm:"type:uuid;index" json:"reversed_entry_id"`
	ReversedAt       *time.Time     `json:"reversed_at"`
	ReversedByUserID *string        `gorm:"type:uuid;index" json:"reversed_by_user_id"`
	CreatedByUserID  string         `gorm:"type:uuid;not null;index" json:"created_by_user_id"`
	UpdatedByUserID  *string        `gorm:"type:uuid;index" json:"updated_by_user_id"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (JournalEntry) TableName() string { return "journal_entries" }

type JournalEntryLine struct {
	ID         string `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID string `gorm:"type:uuid;not null;index" json:"business_id"`
	// BranchID must match both the entry's branch and the account's branch;
	// migration 000095 enforces that with composite foreign keys. Nullable only
	// so historical rows can be backfilled by an operator.
	BranchID       *string        `gorm:"type:uuid;index" json:"branch_id"`
	JournalEntryID string         `gorm:"type:uuid;not null;index" json:"journal_entry_id"`
	AccountID      string         `gorm:"type:uuid;not null;index" json:"account_id"`
	LineNumber     int            `gorm:"not null" json:"line_number"`
	DebitAmount    float64        `gorm:"not null;default:0" json:"debit_amount"`
	CreditAmount   float64        `gorm:"not null;default:0" json:"credit_amount"`
	Description    string         `json:"description"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (JournalEntryLine) TableName() string { return "journal_entry_lines" }
