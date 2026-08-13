package accounting

// Phase 4 / W4 — customer store credit.
//
// Chart account 2200 Customer Advance is a control account; customer_credits
// is its per-customer subledger for credit-sourced balances (sales returns
// settled as store credit, bakery advances converted on cancellation, manual
// grants). Redemption consumes rows oldest-first under row locks so two
// terminals cannot double-spend a balance.

import (
	"strings"
	"time"

	"gorm.io/gorm"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type CustomerCredit struct {
	ID              string         `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID      string         `gorm:"type:uuid;not null;index" json:"business_id"`
	BranchID        string         `gorm:"type:uuid;not null;index" json:"branch_id"`
	CustomerID      string         `gorm:"type:uuid;not null;index" json:"customer_id"`
	SourceType      string         `gorm:"size:50;not null" json:"source_type"`
	SourceID        *string        `gorm:"type:uuid;index" json:"source_id"`
	JournalEntryID  *string        `gorm:"type:uuid;index" json:"journal_entry_id"`
	Amount          float64        `gorm:"not null" json:"amount"`
	Balance         float64        `gorm:"not null" json:"balance"`
	Notes           string         `gorm:"not null;default:''" json:"notes"`
	CreatedByUserID string         `gorm:"type:uuid;not null" json:"created_by_user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (CustomerCredit) TableName() string { return "customer_credits" }

type CustomerCreditRedemption struct {
	ID               string    `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID       string    `gorm:"type:uuid;not null;index" json:"business_id"`
	CustomerCreditID string    `gorm:"type:uuid;not null;index" json:"customer_credit_id"`
	SaleID           string    `gorm:"type:uuid;not null;index" json:"sale_id"`
	Amount           float64   `gorm:"not null" json:"amount"`
	CreatedAt        time.Time `json:"created_at"`
}

func (CustomerCreditRedemption) TableName() string { return "customer_credit_redemptions" }

type CreateCustomerCreditInput struct {
	BranchID       string
	CustomerID     string
	SourceType     string // 'sales_return' | 'bakery_order' | 'manual'
	SourceID       *string
	JournalEntryID *string
	Amount         float64
	Notes          string
}

// CreateCustomerCredit writes a subledger row for money the business now
// owes the customer as store credit. The caller is responsible for the
// matching 2200 ledger effect (or, for bakery advance conversions, for the
// fact that 2200 already holds the amount).
func (s *Service) CreateCustomerCredit(tx *gorm.DB, currentUser *utils.AuthContext, input CreateCustomerCreditInput) (*CustomerCredit, error) {
	amount := roundMoney(input.Amount)
	if amount <= 0 {
		return nil, apperrors.BadRequest("store credit amount must be greater than zero", nil)
	}
	if strings.TrimSpace(input.CustomerID) == "" {
		return nil, apperrors.BadRequest("store credit requires a customer", nil)
	}
	switch input.SourceType {
	case "sales_return", "bakery_order", "manual":
	default:
		return nil, apperrors.BadRequest("invalid store credit source type", map[string]interface{}{"source_type": input.SourceType})
	}
	credit := &CustomerCredit{
		ID:              utils.NewUUID(),
		BusinessID:      currentUser.BusinessID,
		BranchID:        strings.TrimSpace(input.BranchID),
		CustomerID:      strings.TrimSpace(input.CustomerID),
		SourceType:      input.SourceType,
		SourceID:        input.SourceID,
		JournalEntryID:  input.JournalEntryID,
		Amount:          amount,
		Balance:         amount,
		Notes:           strings.TrimSpace(input.Notes),
		CreatedByUserID: currentUser.UserID,
	}
	if err := tx.Create(credit).Error; err != nil {
		return nil, apperrors.Internal("failed to create customer credit")
	}
	return credit, nil
}

// CustomerCreditBalance returns the customer's open store-credit balance.
func (s *Service) CustomerCreditBalance(tx *gorm.DB, businessID, customerID string) (float64, error) {
	db := tx
	if db == nil {
		db = s.db
	}
	var balance float64
	err := db.Table("customer_credits").
		Select("COALESCE(SUM(balance), 0)").
		Where("business_id = ? AND customer_id = ? AND deleted_at IS NULL", businessID, strings.TrimSpace(customerID)).
		Scan(&balance).Error
	if err != nil {
		return 0, apperrors.Internal("failed to load customer credit balance")
	}
	return roundMoney(balance), nil
}

// RedeemCustomerCredit consumes `amount` of the customer's credit oldest-
// first inside the caller's transaction. Rows are locked FOR UPDATE, so two
// racing checkouts serialize and the loser sees the reduced balance (400 on
// insufficient funds, never a negative balance).
func (s *Service) RedeemCustomerCredit(tx *gorm.DB, currentUser *utils.AuthContext, customerID, saleID string, amount float64) error {
	amount = roundMoney(amount)
	if amount <= 0 {
		return apperrors.BadRequest("store credit redemption must be greater than zero", nil)
	}
	var credits []CustomerCredit
	if err := tx.
		Raw(`SELECT * FROM customer_credits
			WHERE business_id = ? AND customer_id = ? AND balance > 0 AND deleted_at IS NULL
			ORDER BY created_at ASC, id ASC
			FOR UPDATE`, currentUser.BusinessID, strings.TrimSpace(customerID)).
		Scan(&credits).Error; err != nil {
		return apperrors.Internal("failed to lock customer credits for redemption")
	}
	remaining := amount
	now := time.Now().UTC()
	for _, credit := range credits {
		if remaining <= 0 {
			break
		}
		slice := roundMoney(credit.Balance)
		if slice > remaining {
			slice = remaining
		}
		newBalance := roundMoney(credit.Balance - slice)
		if err := tx.Table("customer_credits").
			Where("id = ? AND business_id = ?", credit.ID, currentUser.BusinessID).
			Updates(map[string]interface{}{"balance": newBalance, "updated_at": now}).Error; err != nil {
			return apperrors.Internal("failed to update customer credit balance")
		}
		if err := tx.Create(&CustomerCreditRedemption{
			ID:               utils.NewUUID(),
			BusinessID:       currentUser.BusinessID,
			CustomerCreditID: credit.ID,
			SaleID:           saleID,
			Amount:           slice,
			CreatedAt:        now,
		}).Error; err != nil {
			return apperrors.Internal("failed to record customer credit redemption")
		}
		remaining = roundMoney(remaining - slice)
	}
	if remaining > 0 {
		return apperrors.BadRequest("customer store credit balance is insufficient", map[string]interface{}{"missing_amount": remaining})
	}
	return nil
}

type CustomerCreditReconciliationRow struct {
	CustomerID   string  `json:"customer_id"`
	CustomerName string  `json:"customer_name"`
	Balance      float64 `json:"balance"`
}

type CustomerCreditReconciliationResponse struct {
	Rows []CustomerCreditReconciliationRow `json:"rows"`
	// SubledgerTotal is SUM(balance) over open credit rows.
	SubledgerTotal float64 `json:"subledger_total"`
	// LedgerCreditSourced reconstructs the credit-sourced 2200 movement from
	// the ledger: store-credit issues (Cr 2200 in sales_return journals)
	// minus redemptions (Dr 2200 in pos_sale journals), plus bakery advance
	// conversions (ledger-neutral — the 2200 credit predates the conversion —
	// so their subledger amounts are added back for comparability).
	LedgerCreditSourced float64 `json:"ledger_credit_sourced"`
	Drift               float64 `json:"drift"`
}

// CustomerCreditReconciliation compares the subledger against the ledger's
// credit-sourced 2200 activity and reports drift (audit W4 acceptance #4).
func (s *Service) CustomerCreditReconciliation(currentUser *utils.AuthContext) (*CustomerCreditReconciliationResponse, error) {
	response := &CustomerCreditReconciliationResponse{Rows: []CustomerCreditReconciliationRow{}}
	if err := s.db.Table("customer_credits cc").
		Select("cc.customer_id, COALESCE(c.full_name, 'Customer') AS customer_name, COALESCE(SUM(cc.balance), 0) AS balance").
		Joins("LEFT JOIN customers c ON c.id = cc.customer_id AND c.business_id = cc.business_id").
		Where("cc.business_id = ? AND cc.deleted_at IS NULL", currentUser.BusinessID).
		Group("cc.customer_id, c.full_name").
		Having("COALESCE(SUM(cc.balance), 0) <> 0").
		Order("balance DESC").
		Scan(&response.Rows).Error; err != nil {
		return nil, apperrors.Internal("failed to total customer credit subledger")
	}
	for _, row := range response.Rows {
		response.SubledgerTotal = roundMoney(response.SubledgerTotal + row.Balance)
	}

	var issued float64
	if err := s.db.Table("journal_entry_lines jel").
		Joins("JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id").
		Joins("JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id").
		Where("jel.business_id = ? AND je.status = 'posted' AND je.deleted_at IS NULL", currentUser.BusinessID).
		Where("coa.account_code = '2200'").
		Where("je.source_type = 'sales_return' AND EXISTS (SELECT 1 FROM sales_returns sr WHERE sr.id::text = je.source_id AND sr.refund_mode = 'store_credit')").
		Select("COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)").
		Scan(&issued).Error; err != nil {
		return nil, apperrors.Internal("failed to total ledger store-credit issues")
	}
	var redeemed float64
	if err := s.db.Table("journal_entry_lines jel").
		Joins("JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id").
		Joins("JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id").
		Where("jel.business_id = ? AND je.status = 'posted' AND je.deleted_at IS NULL", currentUser.BusinessID).
		Where("coa.account_code = '2200'").
		Where("je.source_type = 'pos_sale'").
		Select("COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)").
		Scan(&redeemed).Error; err != nil {
		return nil, apperrors.Internal("failed to total ledger store-credit redemptions")
	}
	var converted float64
	if err := s.db.Table("customer_credits").
		Select("COALESCE(SUM(amount), 0)").
		Where("business_id = ? AND source_type = 'bakery_order' AND deleted_at IS NULL", currentUser.BusinessID).
		Scan(&converted).Error; err != nil {
		return nil, apperrors.Internal("failed to total bakery credit conversions")
	}
	response.LedgerCreditSourced = roundMoney(issued - redeemed + converted)
	response.Drift = roundMoney(response.SubledgerTotal - response.LedgerCreditSourced)
	return response, nil
}

// ListCustomerCredits returns a customer's credit rows, newest first.
func (s *Service) ListCustomerCredits(currentUser *utils.AuthContext, customerID string) ([]CustomerCredit, error) {
	if strings.TrimSpace(customerID) == "" {
		return nil, apperrors.BadRequest("customer_id is required", nil)
	}
	var credits []CustomerCredit
	if err := s.db.
		Where("business_id = ? AND customer_id = ? AND deleted_at IS NULL", currentUser.BusinessID, strings.TrimSpace(customerID)).
		Order("created_at DESC").
		Find(&credits).Error; err != nil {
		return nil, apperrors.Internal("failed to list customer credits")
	}
	return credits, nil
}
