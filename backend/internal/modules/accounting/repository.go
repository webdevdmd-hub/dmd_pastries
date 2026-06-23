package accounting

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

type posSaleAccountingRow struct {
	ID                       string
	BusinessID               string
	BranchID                 string
	SaleNumber               string
	TotalAmount              float64
	PaidAmount               float64
	ChangeAmount             float64
	TaxAmount                float64
	ChargeAmount             float64
	ChargeTaxAmount          float64
	SaleStatus               string
	AccountingJournalEntryID *string
	COGSJournalEntryID       *string
	VoidJournalEntryID       *string
	SoldAt                   time.Time
}

type posPaymentAccountingRow struct {
	ID                        string
	Amount                    float64
	PaymentStatus             string
	PaymentMethodNameSnapshot string
	PaymentMethodTypeSnapshot string
	DefaultPaymentAccountID   *string
	PaymentAccountBranchID    *string
	PaymentAccountName        string
	ChartAccountID            string
}

type bakeryOrderAccountingRow struct {
	ID                       string
	BusinessID               string
	BranchID                 string
	OrderNumber              string
	TotalAmount              float64
	PaidAmount               float64
	BalanceAmount            float64
	TaxAmount                float64
	ChargeAmount             float64
	ChargeTaxAmount          float64
	OrderStatus              string
	AccountingJournalEntryID *string
}

type bakeryPaymentAccountingRow struct {
	ID                        string
	BusinessID                string
	BakeryOrderID             string
	BranchID                  string
	OrderNumber               string
	OrderStatus               string
	PaymentType               string
	Amount                    float64
	PaymentMethodNameSnapshot string
	DefaultPaymentAccountID   *string
	PaymentAccountBranchID    *string
	PaymentAccountName        string
	ChartAccountID            string
	JournalEntryID            *string
	PaidAt                    time.Time
}

type salesReturnAccountingRow struct {
	ID                      string
	BusinessID              string
	BranchID                string
	ReturnNumber            string
	ReturnDate              time.Time
	TaxAmount               float64
	ChargeAmount            float64
	ChargeTaxAmount         float64
	ReturnTotal             float64
	RefundAmount            float64
	RefundMode              string
	Status                  string
	RefundPaymentMethodID   *string
	RefundPaymentMethodName string
	DefaultPaymentAccountID *string
	PaymentAccountBranchID  *string
	PaymentAccountName      string
	ChartAccountID          string
	JournalEntryID          *string
	InventoryJournalEntryID *string
}

type purchaseReturnAccountingRow struct {
	ID                  string
	BusinessID          string
	BranchID            string
	ReturnNumber        string
	ReturnDate          time.Time
	TaxAmount           float64
	ChargeAmount        float64
	ChargeTaxAmount     float64
	ReturnTotal         float64
	Status              string
	AppliedCreditAmount float64
	OpenCreditAmount    float64
	JournalEntryID      *string
}

type expenseAccountingRow struct {
	ID                   string
	BusinessID           string
	BranchID             string
	ExpenseNumber        string
	ExpenseDate          time.Time
	ExpenseAccountID     string
	PaidThroughAccountID string
	Amount               float64
	ReferenceNumber      string
	Notes                string
	Status               string
	JournalEntryID       *string
}

type purchaseInvoiceAccountingRow struct {
	ID                     string
	BusinessID             string
	BranchID               string
	InvoiceNumber          string
	InvoiceDate            time.Time
	Status                 string
	SubtotalAmount         float64
	TaxAmount              float64
	BillDiscountAmount     float64
	ChargeAmount           float64
	ChargeTaxAmount        float64
	TotalAmount            float64
	JournalEntryID         *string
	ReversalJournalEntryID *string
}

type purchaseInvoiceItemAccountingRow struct {
	ID                  string
	LineType            string
	ItemType            string
	AccountID           *string
	AccountNameSnapshot string
	AccountCodeSnapshot string
	Quantity            float64
	UnitCost            float64
	DiscountAmount      float64
	TaxAmount           float64
	LineTotal           float64
}

type purchaseInvoicePaymentAccountingRow struct {
	ID                        string
	BusinessID                string
	BranchID                  string
	PurchaseInvoiceID         string
	InvoiceNumber             string
	PaymentMethodNameSnapshot string
	Amount                    float64
	PaymentStatus             string
	DefaultPaymentAccountID   *string
	PaymentAccountBranchID    *string
	PaymentAccountName        string
	ChartAccountID            string
	JournalEntryID            *string
	PaidAt                    time.Time
}

type supplierPaymentAccountingRow struct {
	ID                     string
	BusinessID             string
	BranchID               string
	SupplierID             string
	SupplierName           string
	PaymentMethodName      string
	Amount                 float64
	AllocatedAmount        float64
	UnappliedAmount        float64
	Status                 string
	PaidThroughAccountID   string
	PaymentAccountBranchID *string
	PaymentAccountName     string
	ChartAccountID         string
	JournalEntryID         *string
	PaymentDate            time.Time
	ReferenceNumber        string
}

type purchaseReceiptAccountingRow struct {
	ID                string
	BusinessID        string
	BranchID          string
	ReceiptNumber     string
	ReceivedDate      time.Time
	Status            string
	PurchaseInvoiceID *string
	JournalEntryID    *string
}

type stockMovementAccountingRow struct {
	ID                       string
	BusinessID               string
	BranchID                 string
	MovementType             string
	MovementDirection        string
	ReferenceType            string
	ReferenceID              *string
	ReferenceNumber          string
	TotalCost                float64
	AccountingJournalEntryID *string
	IsReversal               bool
	ReversedMovementID       *string
	CreatedAt                time.Time
}

type productionBatchAccountingRow struct {
	ID                    string
	BusinessID            string
	BranchID              string
	ProductionBatchNumber string
	Status                string
	CompletedAt           *time.Time
}

type accountingSettingsRow struct {
	BusinessID                    string
	FinancialYearStartMonth       int
	FinancialYearStartDay         int
	FinancialYearStartMonthIsNull bool
	FinancialYearStartDayIsNull   bool
	CreatedAt                     time.Time
	UpdatedAt                     time.Time
}

type documentChargeAccountingRow struct {
	ChargeType  string
	ChargeName  string
	TaxAmount   float64
	TotalAmount float64
}

func (r *Repository) Create(tx *gorm.DB, account *ChartAccount) error {
	return tx.Create(account).Error
}

func (r *Repository) CreateJournalEntry(tx *gorm.DB, entry *JournalEntry, lines []JournalEntryLine) error {
	if err := tx.Create(entry).Error; err != nil {
		return err
	}
	return tx.Create(&lines).Error
}

func (r *Repository) ReplaceJournalEntryLines(tx *gorm.DB, businessID, entryID string, lines []JournalEntryLine) error {
	if err := tx.Model(&JournalEntryLine{}).Where("business_id = ? AND journal_entry_id = ? AND deleted_at IS NULL", businessID, entryID).Update("deleted_at", gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}).Error; err != nil {
		return err
	}
	if len(lines) == 0 {
		return nil
	}
	return tx.Create(&lines).Error
}

func (r *Repository) UpdateJournalEntry(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&JournalEntry{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CountJournalReversalLinks(tx *gorm.DB, businessID, id string) (int64, error) {
	var count int64
	err := tx.Model(&JournalEntry{}).
		Where("business_id = ? AND reversed_entry_id = ? AND deleted_at IS NULL", businessID, id).
		Count(&count).Error
	return count, err
}

func (r *Repository) HardDeleteJournalEntry(tx *gorm.DB, businessID, id string) error {
	if err := tx.Unscoped().Where("business_id = ? AND journal_entry_id = ?", businessID, id).Delete(&JournalEntryLine{}).Error; err != nil {
		return err
	}
	result := tx.Unscoped().Where("business_id = ? AND id = ?", businessID, id).Delete(&JournalEntry{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) List(businessID string, query ChartAccountListQuery) ([]ChartAccount, int64, error) {
	db := r.db.Model(&ChartAccount{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyChartAccountFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "asc"
	if strings.ToLower(query.SortOrder) == "desc" {
		sortOrder = "desc"
	}
	var accounts []ChartAccount
	err := db.Order(fmt.Sprintf("%s %s", safeChartAccountSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&accounts).Error
	return accounts, total, err
}

func (r *Repository) FindByID(businessID, id string) (*ChartAccount, error) {
	var account ChartAccount
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&account).Error
	return &account, err
}

func (r *Repository) FindAccountForReport(businessID, id string) (*GeneralLedgerAccountResponse, error) {
	var account GeneralLedgerAccountResponse
	err := r.db.Table("chart_of_accounts").
		Select("id AS account_id, account_code, account_name, account_type, normal_balance").
		Where("business_id = ? AND id = ?", businessID, id).
		First(&account).Error
	return &account, err
}

func (r *Repository) FindJournalEntryByID(businessID, id string) (*JournalEntry, error) {
	var entry JournalEntry
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&entry).Error
	return &entry, err
}

func (r *Repository) FindJournalEntryForUpdate(tx *gorm.DB, businessID, id string) (*JournalEntry, error) {
	var entry JournalEntry
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&entry).Error
	return &entry, err
}

func (r *Repository) ListJournalEntries(businessID string, query JournalEntryListQuery) ([]JournalEntry, int64, error) {
	db := r.db.Model(&JournalEntry{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyJournalEntryFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var entries []JournalEntry
	err := db.Order(fmt.Sprintf("%s %s", safeJournalEntrySortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&entries).Error
	return entries, total, err
}

func (r *Repository) Update(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&ChartAccount{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) AccountCodeExists(tx *gorm.DB, businessID, code string) (bool, error) {
	var count int64
	err := tx.Model(&ChartAccount{}).Where("business_id = ? AND LOWER(account_code) = LOWER(?) AND deleted_at IS NULL", businessID, code).Count(&count).Error
	return count > 0, err
}

func (r *Repository) HasChildren(tx *gorm.DB, businessID, id string) (bool, error) {
	var count int64
	err := tx.Model(&ChartAccount{}).Where("business_id = ? AND parent_account_id = ? AND deleted_at IS NULL", businessID, id).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ValidateActiveAccount(tx *gorm.DB, businessID, accountID string) (*ChartAccount, error) {
	var account ChartAccount
	err := tx.Where("business_id = ? AND id = ? AND status = ? AND deleted_at IS NULL", businessID, accountID, "active").First(&account).Error
	return &account, err
}

func (r *Repository) FindActiveAccountByCode(tx *gorm.DB, businessID, accountCode string) (*ChartAccount, error) {
	var account ChartAccount
	err := tx.Where("business_id = ? AND account_code = ? AND status = ? AND deleted_at IS NULL", businessID, accountCode, "active").First(&account).Error
	return &account, err
}

func (r *Repository) ListAccountMappings(businessID string) ([]AccountMappingResponse, error) {
	var rows []AccountMappingResponse
	err := r.db.Table("accounting_account_mappings aam").
		Select(`aam.id, aam.business_id, aam.mapping_key, aam.chart_account_id,
			coa.account_code AS chart_account_code,
			coa.account_name AS chart_account_name,
			coa.account_type AS chart_account_type,
			coa.account_group,
			aam.description,
			aam.created_at,
			aam.updated_at`).
		Joins("JOIN chart_of_accounts coa ON coa.id = aam.chart_account_id AND coa.business_id = aam.business_id AND coa.deleted_at IS NULL").
		Where("aam.business_id = ? AND aam.deleted_at IS NULL", businessID).
		Order("aam.mapping_key ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) FindAccountMapping(tx *gorm.DB, businessID, mappingKey string) (*AccountMapping, error) {
	var mapping AccountMapping
	err := tx.Where("business_id = ? AND mapping_key = ? AND deleted_at IS NULL", businessID, mappingKey).First(&mapping).Error
	return &mapping, err
}

func (r *Repository) EnsureAccountingSettings(tx *gorm.DB, businessID string) (*accountingSettingsRow, error) {
	if err := tx.Exec(`
		INSERT INTO company_settings (
			id,
			business_id,
			business_display_name,
			vat_number,
			currency,
			timezone,
			financial_year_start_month,
			financial_year_start_day,
			created_at,
			updated_at
		)
		SELECT
			gen_random_uuid(),
			b.id,
			b.business_name,
			b.vat_number,
			b.currency,
			b.timezone,
			1,
			1,
			NOW(),
			NOW()
		FROM businesses b
		WHERE b.id = ?
		  AND b.deleted_at IS NULL
		  AND NOT EXISTS (
			  SELECT 1
			  FROM company_settings cs
			  WHERE cs.business_id = b.id
			    AND cs.deleted_at IS NULL
		  )
	`, businessID).Error; err != nil {
		return nil, err
	}
	return r.FindAccountingSettings(tx, businessID)
}

func (r *Repository) FindAccountingSettings(tx *gorm.DB, businessID string) (*accountingSettingsRow, error) {
	var row accountingSettingsRow
	err := tx.Table("company_settings").
		Select(`
			business_id,
			COALESCE(financial_year_start_month, 1) AS financial_year_start_month,
			COALESCE(financial_year_start_day, 1) AS financial_year_start_day,
			financial_year_start_month IS NULL AS financial_year_start_month_is_null,
			financial_year_start_day IS NULL AS financial_year_start_day_is_null,
			created_at,
			updated_at
		`).
		Where("business_id = ? AND deleted_at IS NULL", businessID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateAccountingSettings(tx *gorm.DB, businessID string, updates map[string]interface{}) error {
	result := tx.Table("company_settings").
		Where("business_id = ? AND deleted_at IS NULL", businessID).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpsertAccountMapping(tx *gorm.DB, mapping *AccountMapping) error {
	var existing AccountMapping
	err := tx.Where("business_id = ? AND mapping_key = ? AND deleted_at IS NULL", mapping.BusinessID, mapping.MappingKey).First(&existing).Error
	if err == nil {
		return tx.Model(&existing).Updates(map[string]interface{}{
			"chart_account_id": mapping.ChartAccountID,
			"description":      mapping.Description,
			"updated_at":       time.Now().UTC(),
		}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	return tx.Create(mapping).Error
}

func (r *Repository) FindPostedJournalBySource(tx *gorm.DB, businessID, sourceType, sourceID string) (*JournalEntry, error) {
	var entry JournalEntry
	result := tx.Where("business_id = ? AND source_type = ? AND source_id = ? AND status IN ? AND deleted_at IS NULL", businessID, sourceType, sourceID, []string{"posted", "reversed"}).
		Order("created_at ASC").
		Limit(1).
		Find(&entry)
	if result.Error != nil {
		return &entry, result.Error
	}
	if result.RowsAffected == 0 {
		return &entry, gorm.ErrRecordNotFound
	}
	return &entry, nil
}

func (r *Repository) FindPOSSaleForAccounting(tx *gorm.DB, businessID, saleID string) (*posSaleAccountingRow, error) {
	var row posSaleAccountingRow
	err := tx.Table("sales").
		Select("id, business_id, branch_id, sale_number, total_amount, paid_amount, change_amount, tax_amount, charge_amount, charge_tax_amount, sale_status, accounting_journal_entry_id, cogs_journal_entry_id, void_journal_entry_id, sold_at").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, saleID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) SumStockMovementCostByReference(tx *gorm.DB, businessID, referenceType, referenceID, movementDirection string) (float64, error) {
	var total float64
	err := tx.Table("stock_movements").
		Select("COALESCE(SUM(total_cost), 0)").
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND movement_direction = ?", businessID, referenceType, referenceID, movementDirection).
		Scan(&total).Error
	return total, err
}

func (r *Repository) SumStockMovementCostByReferenceAndType(tx *gorm.DB, businessID, referenceType, referenceID, movementType string) (float64, error) {
	var total float64
	err := tx.Table("stock_movements").
		Select("COALESCE(SUM(total_cost), 0)").
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND movement_type = ?", businessID, referenceType, referenceID, movementType).
		Scan(&total).Error
	return total, err
}

func (r *Repository) FindStockMovementForAccounting(tx *gorm.DB, businessID, movementID string) (*stockMovementAccountingRow, error) {
	var row stockMovementAccountingRow
	err := tx.Table("stock_movements").
		Select("id, business_id, branch_id, movement_type, movement_direction, reference_type, reference_id, reference_number, total_cost, accounting_journal_entry_id, is_reversal, reversed_movement_id, created_at").
		Where("business_id = ? AND id = ?", businessID, movementID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateStockMovementJournalID(tx *gorm.DB, businessID, movementID, journalEntryID string) error {
	return tx.Table("stock_movements").
		Where("business_id = ? AND id = ?", businessID, movementID).
		Update("accounting_journal_entry_id", journalEntryID).Error
}

func (r *Repository) ListDocumentChargesForAccounting(tx *gorm.DB, businessID, documentType, documentID string) ([]documentChargeAccountingRow, error) {
	var rows []documentChargeAccountingRow
	err := tx.Table("document_charges").
		Select("charge_type, charge_name, tax_amount, total_amount").
		Where("business_id = ? AND document_type = ? AND document_id = ? AND deleted_at IS NULL", businessID, documentType, documentID).
		Order("created_at ASC, id ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) UpdateStockMovementJournalByReference(tx *gorm.DB, businessID, referenceType, referenceID, movementDirection, journalEntryID string) error {
	return tx.Table("stock_movements").
		Where("business_id = ? AND reference_type = ? AND reference_id = ? AND movement_direction = ?", businessID, referenceType, referenceID, movementDirection).
		Update("accounting_journal_entry_id", journalEntryID).Error
}

func (r *Repository) UpdatePOSSaleCOGSJournalID(tx *gorm.DB, businessID, saleID, journalEntryID string) error {
	result := tx.Table("sales").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, saleID).
		Update("cogs_journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdatePOSSaleVoidJournalID(tx *gorm.DB, businessID, saleID, journalEntryID string) error {
	result := tx.Table("sales").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, saleID).
		Update("void_journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindPurchaseInvoiceForAccounting(tx *gorm.DB, businessID, invoiceID string) (*purchaseInvoiceAccountingRow, error) {
	var row purchaseInvoiceAccountingRow
	err := tx.Table("purchase_invoices").
		Select("id, business_id, branch_id, invoice_number, invoice_date, status, subtotal_amount, tax_amount, bill_discount_amount, charge_amount, charge_tax_amount, total_amount, journal_entry_id, reversal_journal_entry_id").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, invoiceID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) ListPurchaseInvoiceItemsForAccounting(tx *gorm.DB, businessID, invoiceID string) ([]purchaseInvoiceItemAccountingRow, error) {
	var rows []purchaseInvoiceItemAccountingRow
	err := tx.Table("purchase_invoice_items").
		Select("id, line_type, item_type, account_id, account_name_snapshot, account_code_snapshot, quantity, unit_cost, discount_amount, tax_amount, line_total").
		Where("business_id = ? AND purchase_invoice_id = ? AND deleted_at IS NULL", businessID, invoiceID).
		Order("created_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) UpdatePurchaseInvoiceJournalID(tx *gorm.DB, businessID, invoiceID, journalEntryID string) error {
	result := tx.Table("purchase_invoices").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, invoiceID).
		Update("journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdatePurchaseInvoiceReversalJournalID(tx *gorm.DB, businessID, invoiceID, journalEntryID string) error {
	result := tx.Table("purchase_invoices").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, invoiceID).
		Update("reversal_journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindPurchaseInvoicePaymentForAccounting(tx *gorm.DB, businessID, paymentID string) (*purchaseInvoicePaymentAccountingRow, error) {
	var row purchaseInvoicePaymentAccountingRow
	err := tx.Table("purchase_invoice_payments pip").
		Select(`
			pip.id,
			pip.business_id,
			pip.branch_id,
			pip.purchase_invoice_id,
			pi.invoice_number,
			pip.payment_method_name_snapshot,
			pip.amount,
			pip.payment_status,
			pm.default_payment_account_id,
			pa.branch_id AS payment_account_branch_id,
			COALESCE(pa.account_name, '') AS payment_account_name,
			COALESCE(pa.chart_account_id::text, '') AS chart_account_id,
			pip.journal_entry_id,
			pip.paid_at
		`).
		Joins("JOIN purchase_invoices pi ON pi.id = pip.purchase_invoice_id AND pi.business_id = pip.business_id AND pi.deleted_at IS NULL").
		Joins("JOIN payment_methods pm ON pm.id = pip.payment_method_id AND pm.business_id = pip.business_id AND pm.deleted_at IS NULL").
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = pip.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("pip.business_id = ? AND pip.id = ? AND pip.deleted_at IS NULL", businessID, paymentID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdatePurchaseInvoicePaymentJournalID(tx *gorm.DB, businessID, paymentID, journalEntryID string) error {
	result := tx.Table("purchase_invoice_payments").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, paymentID).
		Update("journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindSupplierPaymentForAccounting(tx *gorm.DB, businessID, paymentID string) (*supplierPaymentAccountingRow, error) {
	var row supplierPaymentAccountingRow
	err := tx.Table("supplier_payments sp").
		Select(`
			sp.id,
			sp.business_id,
			sp.branch_id,
			sp.supplier_id,
			s.supplier_name,
			sp.payment_method_name_snapshot AS payment_method_name,
			sp.amount,
			sp.allocated_amount,
			sp.unapplied_amount,
			sp.status,
			sp.paid_through_account_id,
			pa.branch_id AS payment_account_branch_id,
			pa.account_name AS payment_account_name,
			pa.chart_account_id::text AS chart_account_id,
			sp.journal_entry_id,
			sp.payment_date,
			sp.reference_number
		`).
		Joins("JOIN suppliers s ON s.id = sp.supplier_id AND s.business_id = sp.business_id AND s.deleted_at IS NULL").
		Joins("JOIN payment_accounts pa ON pa.id = sp.paid_through_account_id AND pa.business_id = sp.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("sp.business_id = ? AND sp.id = ? AND sp.deleted_at IS NULL", businessID, paymentID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateSupplierPaymentJournalID(tx *gorm.DB, businessID, paymentID, journalEntryID string) error {
	result := tx.Table("supplier_payments").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, paymentID).
		Update("journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindPurchaseReceiptForAccounting(tx *gorm.DB, businessID, receiptID string) (*purchaseReceiptAccountingRow, error) {
	var row purchaseReceiptAccountingRow
	err := tx.Table("purchase_receipts").
		Select("id, business_id, branch_id, receipt_number, received_date, status, purchase_invoice_id, journal_entry_id").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, receiptID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdatePurchaseReceiptJournalID(tx *gorm.DB, businessID, receiptID, journalEntryID string) error {
	result := tx.Table("purchase_receipts").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, receiptID).
		Update("journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindProductionBatchForAccounting(tx *gorm.DB, businessID, batchID string) (*productionBatchAccountingRow, error) {
	var row productionBatchAccountingRow
	err := tx.Table("production_batches").
		Select("id, business_id, branch_id, production_batch_number, status, completed_at").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, batchID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) ListPOSSalePaymentsForAccounting(tx *gorm.DB, businessID, saleID string) ([]posPaymentAccountingRow, error) {
	var rows []posPaymentAccountingRow
	err := tx.Table("sale_payments sp").
		Select(`
			sp.id,
			sp.amount,
			sp.payment_status,
			sp.payment_method_name_snapshot,
			sp.payment_method_type_snapshot,
			pm.default_payment_account_id,
			pa.branch_id AS payment_account_branch_id,
			COALESCE(pa.account_name, '') AS payment_account_name,
			COALESCE(pa.chart_account_id::text, '') AS chart_account_id
		`).
		Joins("JOIN payment_methods pm ON pm.id = sp.payment_method_id AND pm.business_id = sp.business_id AND pm.deleted_at IS NULL").
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = sp.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("sp.business_id = ? AND sp.sale_id = ? AND sp.deleted_at IS NULL AND sp.payment_status = ?", businessID, saleID, "completed").
		Order("sp.paid_at ASC, sp.created_at ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) UpdatePOSSaleAccountingJournalID(tx *gorm.DB, businessID, saleID, journalEntryID string) error {
	result := tx.Table("sales").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, saleID).
		Updates(map[string]interface{}{"accounting_journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdatePOSSalePaymentJournalIDs(tx *gorm.DB, businessID, saleID, journalEntryID string) error {
	return tx.Table("sale_payments").
		Where("business_id = ? AND sale_id = ? AND deleted_at IS NULL AND payment_status = ?", businessID, saleID, "completed").
		Updates(map[string]interface{}{"journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()}).Error
}

func (r *Repository) FindBakeryOrderForAccounting(tx *gorm.DB, businessID, orderID string) (*bakeryOrderAccountingRow, error) {
	var row bakeryOrderAccountingRow
	err := tx.Table("bakery_orders").
		Select("id, business_id, branch_id, order_number, total_amount, paid_amount, balance_amount, tax_amount, charge_amount, charge_tax_amount, order_status, accounting_journal_entry_id").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, orderID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) FindBakeryPaymentForAccounting(tx *gorm.DB, businessID, paymentID string) (*bakeryPaymentAccountingRow, error) {
	var row bakeryPaymentAccountingRow
	err := tx.Table("bakery_order_payments bop").
		Select(`
			bop.id,
			bop.business_id,
			bop.bakery_order_id,
			bo.branch_id,
			bo.order_number,
			bo.order_status,
			bop.payment_type,
			bop.amount,
			bop.payment_method_name_snapshot,
			pm.default_payment_account_id,
			pa.branch_id AS payment_account_branch_id,
			COALESCE(pa.account_name, '') AS payment_account_name,
			COALESCE(pa.chart_account_id::text, '') AS chart_account_id,
			bop.journal_entry_id,
			bop.paid_at
		`).
		Joins("JOIN bakery_orders bo ON bo.id = bop.bakery_order_id AND bo.business_id = bop.business_id AND bo.deleted_at IS NULL").
		Joins("JOIN payment_methods pm ON pm.id = bop.payment_method_id AND pm.business_id = bop.business_id AND pm.deleted_at IS NULL").
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = bop.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("bop.business_id = ? AND bop.id = ?", businessID, paymentID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateBakeryPaymentJournalID(tx *gorm.DB, businessID, paymentID, journalEntryID string) error {
	result := tx.Table("bakery_order_payments").
		Where("business_id = ? AND id = ?", businessID, paymentID).
		Update("journal_entry_id", journalEntryID)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdateBakeryOrderAccountingJournalID(tx *gorm.DB, businessID, orderID, journalEntryID string) error {
	result := tx.Table("bakery_orders").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, orderID).
		Updates(map[string]interface{}{"accounting_journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindSalesReturnForAccounting(tx *gorm.DB, businessID, salesReturnID string) (*salesReturnAccountingRow, error) {
	var row salesReturnAccountingRow
	err := tx.Table("sales_returns sr").
		Select(`
			sr.id,
			sr.business_id,
			sr.branch_id,
			sr.return_number,
			sr.return_date,
			sr.tax_amount,
			sr.charge_amount,
			sr.charge_tax_amount,
			sr.return_total,
			sr.refund_amount,
			sr.refund_mode,
			sr.status,
			sr.refund_payment_method_id,
			COALESCE(pm.method_name, '') AS refund_payment_method_name,
			pm.default_payment_account_id,
			pa.branch_id AS payment_account_branch_id,
			COALESCE(pa.account_name, '') AS payment_account_name,
			COALESCE(pa.chart_account_id::text, '') AS chart_account_id,
			sr.journal_entry_id,
			sr.inventory_journal_entry_id
		`).
		Joins("LEFT JOIN payment_methods pm ON pm.id = sr.refund_payment_method_id AND pm.business_id = sr.business_id AND pm.deleted_at IS NULL").
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = sr.business_id AND pa.status = 'active' AND pa.deleted_at IS NULL").
		Where("sr.business_id = ? AND sr.id = ? AND sr.deleted_at IS NULL", businessID, salesReturnID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateSalesReturnJournalID(tx *gorm.DB, businessID, salesReturnID, journalEntryID string) error {
	result := tx.Table("sales_returns").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, salesReturnID).
		Updates(map[string]interface{}{"journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) UpdateSalesReturnInventoryJournalID(tx *gorm.DB, businessID, salesReturnID, journalEntryID string) error {
	result := tx.Table("sales_returns").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, salesReturnID).
		Updates(map[string]interface{}{"inventory_journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindPurchaseReturnForAccounting(tx *gorm.DB, businessID, purchaseReturnID string) (*purchaseReturnAccountingRow, error) {
	var row purchaseReturnAccountingRow
	err := tx.Table("purchase_returns").
		Select("id, business_id, branch_id, return_number, return_date, tax_amount, charge_amount, charge_tax_amount, return_total, status, applied_credit_amount, open_credit_amount, journal_entry_id").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, purchaseReturnID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) FindExpenseForAccounting(tx *gorm.DB, businessID, expenseID string) (*expenseAccountingRow, error) {
	var row expenseAccountingRow
	err := tx.Table("expenses").
		Select("id, business_id, branch_id, expense_number, expense_date, expense_account_id, paid_through_account_id, amount, reference_number, notes, status, journal_entry_id").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, expenseID).
		Take(&row).Error
	return &row, err
}

func (r *Repository) UpdateExpenseJournalID(tx *gorm.DB, businessID, expenseID, journalEntryID string) error {
	result := tx.Table("expenses").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, expenseID).
		Updates(map[string]interface{}{"journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListBackfillCandidateIDs(tx *gorm.DB, businessID, target string, req BackfillJournalsRequest) ([]string, error) {
	query, idColumn, dateColumn, err := r.backfillCandidateQuery(tx, businessID, target, req)
	if err != nil {
		return nil, err
	}
	if req.Limit > 0 {
		query = query.Limit(req.Limit)
	}

	var ids []string
	err = query.Select(idColumn).Order(dateColumn+" ASC, created_at ASC, "+idColumn+" ASC").Pluck(idColumn, &ids).Error
	return ids, err
}

func (r *Repository) CountBackfillCandidates(tx *gorm.DB, businessID, target string, req BackfillJournalsRequest) (int64, error) {
	query, _, _, err := r.backfillCandidateQuery(tx, businessID, target, req)
	if err != nil {
		return 0, err
	}
	var count int64
	err = query.Count(&count).Error
	return count, err
}

func (r *Repository) backfillCandidateQuery(tx *gorm.DB, businessID, target string, req BackfillJournalsRequest) (*gorm.DB, string, string, error) {
	table, idColumn, businessColumn, branchColumn, deletedCondition, dateColumn, statusColumn, statusValue, missingCondition, extraCondition := backfillTargetQuery(target)
	if table == "" {
		return nil, "", "", fmt.Errorf("unsupported backfill target %s", target)
	}

	query := tx.Table(table).
		Where(businessColumn+" = ?", businessID)
	if deletedCondition != "" {
		query = query.Where(deletedCondition)
	}
	if statusColumn != "" {
		query = query.Where(statusColumn+" = ?", statusValue)
	}
	if missingCondition != "" {
		query = query.Where(missingCondition)
	}
	if extraCondition != "" {
		query = query.Where(extraCondition)
	}
	if strings.TrimSpace(req.BranchID) != "" {
		branchID := strings.TrimSpace(req.BranchID)
		if target == "bakery_order_payments" {
			query = query.Where(`EXISTS (
				SELECT 1 FROM bakery_orders bo
				WHERE bo.id = bakery_order_payments.bakery_order_id
				  AND bo.business_id = bakery_order_payments.business_id
				  AND bo.branch_id = ?
				  AND bo.deleted_at IS NULL
			)`, branchID)
		} else {
			query = query.Where(branchColumn+" = ?", branchID)
		}
	}
	if strings.TrimSpace(req.DateFrom) != "" {
		query = query.Where(dateColumn+" >= ?", strings.TrimSpace(req.DateFrom))
	}
	if strings.TrimSpace(req.DateTo) != "" {
		query = query.Where(dateColumn+" <= ?", strings.TrimSpace(req.DateTo))
	}
	return query, idColumn, dateColumn, nil
}

func backfillTargetQuery(target string) (table, idColumn, businessColumn, branchColumn, deletedCondition, dateColumn, statusColumn, statusValue, missingCondition, extraCondition string) {
	switch target {
	case "pos_sales":
		return "sales", "id", "business_id", "branch_id", "deleted_at IS NULL", "sold_at", "sale_status", "completed", "(accounting_journal_entry_id IS NULL OR cogs_journal_entry_id IS NULL)", ""
	case "bakery_orders":
		return "bakery_orders", "id", "business_id", "branch_id", "deleted_at IS NULL", "created_at", "order_status", "completed", "accounting_journal_entry_id IS NULL", ""
	case "bakery_order_payments":
		return "bakery_order_payments", "id", "business_id", "", "", "paid_at", "", "", "journal_entry_id IS NULL", ""
	case "purchase_invoices":
		return "purchase_invoices", "id", "business_id", "branch_id", "deleted_at IS NULL", "invoice_date", "status", "posted", "journal_entry_id IS NULL", ""
	case "purchase_invoice_payments":
		return "purchase_invoice_payments", "id", "business_id", "branch_id", "deleted_at IS NULL", "paid_at", "payment_status", "completed", "journal_entry_id IS NULL", "supplier_payment_id IS NULL"
	case "supplier_payments":
		return "supplier_payments", "id", "business_id", "branch_id", "deleted_at IS NULL", "payment_date", "status", "completed", "journal_entry_id IS NULL", ""
	case "stock_movements":
		return "stock_movements", "id", "business_id", "branch_id", "", "created_at", "", "", "accounting_journal_entry_id IS NULL", "movement_type IN ('opening_stock','adjustment_in','adjustment_out','wastage')"
	case "manufacturing_batches":
		return "production_batches pb", "pb.id", "pb.business_id", "pb.branch_id", "pb.deleted_at IS NULL", "pb.completed_at", "pb.status", "completed", "", "NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.business_id = pb.business_id AND je.source_type = 'manufacturing_batch' AND je.source_id = pb.id AND je.status IN ('posted','reversed') AND je.deleted_at IS NULL)"
	case "sales_returns":
		return "sales_returns", "id", "business_id", "branch_id", "deleted_at IS NULL", "return_date", "status", "posted", "(journal_entry_id IS NULL OR inventory_journal_entry_id IS NULL)", ""
	case "purchase_returns":
		return "purchase_returns", "id", "business_id", "branch_id", "deleted_at IS NULL", "return_date", "status", "posted", "journal_entry_id IS NULL", ""
	case "expenses":
		return "expenses", "id", "business_id", "branch_id", "deleted_at IS NULL", "expense_date", "status", "posted", "journal_entry_id IS NULL", ""
	default:
		return "", "", "", "", "", "", "", "", "", ""
	}
}

func (r *Repository) ListMissingRequiredAccountMappings(tx *gorm.DB, businessID string, keys []string) ([]string, error) {
	if len(keys) == 0 {
		return []string{}, nil
	}
	var existing []string
	err := tx.Table("accounting_account_mappings aam").
		Select("aam.mapping_key").
		Joins("JOIN chart_of_accounts coa ON coa.id = aam.chart_account_id AND coa.business_id = aam.business_id AND coa.status = 'active' AND coa.deleted_at IS NULL").
		Where("aam.business_id = ? AND aam.mapping_key IN ? AND aam.deleted_at IS NULL", businessID, keys).
		Pluck("aam.mapping_key", &existing).Error
	if err != nil {
		return nil, err
	}
	seen := map[string]struct{}{}
	for _, key := range existing {
		seen[key] = struct{}{}
	}
	missing := make([]string, 0)
	for _, key := range keys {
		if _, ok := seen[key]; !ok {
			missing = append(missing, key)
		}
	}
	return missing, nil
}

func (r *Repository) ListPaymentMethodReadinessIssues(tx *gorm.DB, businessID string) ([]BackfillReadinessIssue, error) {
	var rows []struct {
		ID               string
		MethodName       string
		MethodType       string
		DefaultAccountID *string
		PaymentAccount   string
		AccountStatus    string
		ChartAccountID   *string
		ShowInPOS        bool
		ShowInBakery     bool
		ShowInPurchasing bool
		ShowInExpenses   bool
	}
	err := tx.Table("payment_methods pm").
		Select(`
			pm.id,
			pm.method_name,
			pm.method_type,
			pm.default_payment_account_id,
			COALESCE(pa.account_name, '') AS payment_account,
			COALESCE(pa.status, '') AS account_status,
			pa.chart_account_id,
			pm.show_in_pos,
			pm.show_in_bakery_orders AS show_in_bakery,
			pm.show_in_purchasing,
			pm.show_in_expenses
		`).
		Joins("LEFT JOIN payment_accounts pa ON pa.id = pm.default_payment_account_id AND pa.business_id = pm.business_id AND pa.deleted_at IS NULL").
		Where("pm.business_id = ? AND pm.status = 'active' AND pm.deleted_at IS NULL", businessID).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	issues := make([]BackfillReadinessIssue, 0)
	for _, row := range rows {
		usedByPosting := row.ShowInPOS || row.ShowInBakery || row.ShowInPurchasing || row.ShowInExpenses
		if !usedByPosting {
			continue
		}
		if row.DefaultAccountID == nil || strings.TrimSpace(*row.DefaultAccountID) == "" {
			issues = append(issues, BackfillReadinessIssue{
				Severity: "error",
				CheckKey: "payment_method_account_missing",
				Message:  "Active payment method used by operational posting has no default payment account.",
				Details:  map[string]interface{}{"payment_method_id": row.ID, "method_name": row.MethodName, "method_type": row.MethodType},
			})
			continue
		}
		if row.AccountStatus != "active" {
			issues = append(issues, BackfillReadinessIssue{
				Severity: "error",
				CheckKey: "payment_account_inactive",
				Message:  "Payment method is linked to an inactive or missing payment account.",
				Details:  map[string]interface{}{"payment_method_id": row.ID, "method_name": row.MethodName, "payment_account_id": *row.DefaultAccountID, "payment_account_name": row.PaymentAccount},
			})
			continue
		}
		if row.ChartAccountID == nil || strings.TrimSpace(*row.ChartAccountID) == "" {
			issues = append(issues, BackfillReadinessIssue{
				Severity: "error",
				CheckKey: "payment_account_chart_account_missing",
				Message:  "Linked payment account has no Chart of Accounts ledger.",
				Details:  map[string]interface{}{"payment_method_id": row.ID, "method_name": row.MethodName, "payment_account_id": *row.DefaultAccountID, "payment_account_name": row.PaymentAccount},
			})
		}
	}
	return issues, nil
}

func (r *Repository) CountValueMovementsMissingCost(tx *gorm.DB, businessID string, req BackfillJournalsRequest) (int64, error) {
	query := tx.Table("stock_movements").
		Where("business_id = ?", businessID).
		Where("movement_type IN ?", []string{"opening_stock", "adjustment_in", "adjustment_out", "wastage", "purchase_in", "sale_out", "production_in", "production_out", "purchase_return_out", "purchase_bill_cancel_out", "return_in"}).
		Where("COALESCE(total_cost, 0) <= 0")
	if strings.TrimSpace(req.BranchID) != "" {
		query = query.Where("branch_id = ?", strings.TrimSpace(req.BranchID))
	}
	if strings.TrimSpace(req.DateFrom) != "" {
		query = query.Where("created_at >= ?", strings.TrimSpace(req.DateFrom))
	}
	if strings.TrimSpace(req.DateTo) != "" {
		query = query.Where("created_at <= ?", strings.TrimSpace(req.DateTo))
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

func (r *Repository) UpdatePurchaseReturnJournalID(tx *gorm.DB, businessID, purchaseReturnID, journalEntryID string) error {
	result := tx.Table("purchase_returns").
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, purchaseReturnID).
		Updates(map[string]interface{}{"journal_entry_id": journalEntryID, "updated_at": time.Now().UTC()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) BranchExists(tx *gorm.DB, businessID, branchID string) (bool, error) {
	if strings.TrimSpace(branchID) == "" {
		return true, nil
	}
	var count int64
	err := tx.Table("branches").Where("business_id = ? AND id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, "active").Count(&count).Error
	return count > 0, err
}

func (r *Repository) NextJournalEntryNumber(tx *gorm.DB, businessID string, entryDate time.Time) (string, error) {
	datePart := entryDate.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":journal_entries").Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "JV-" + datePart + "-"
	if err := tx.Model(&JournalEntry{}).Where("business_id = ? AND entry_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) LoadResponses(businessID string, accounts []ChartAccount) ([]ChartAccountResponse, error) {
	parentIDs := make([]string, 0)
	seen := map[string]struct{}{}
	for _, account := range accounts {
		if account.ParentAccountID == nil || *account.ParentAccountID == "" {
			continue
		}
		if _, ok := seen[*account.ParentAccountID]; ok {
			continue
		}
		seen[*account.ParentAccountID] = struct{}{}
		parentIDs = append(parentIDs, *account.ParentAccountID)
	}
	parentNames := map[string]string{}
	if len(parentIDs) > 0 {
		var parents []ChartAccount
		if err := r.db.Select("id, account_name").Where("business_id = ? AND id IN ? AND deleted_at IS NULL", businessID, parentIDs).Find(&parents).Error; err != nil {
			return nil, err
		}
		for _, parent := range parents {
			parentNames[parent.ID] = parent.AccountName
		}
	}
	responses := make([]ChartAccountResponse, 0, len(accounts))
	for _, account := range accounts {
		parentName := ""
		if account.ParentAccountID != nil {
			parentName = parentNames[*account.ParentAccountID]
		}
		responses = append(responses, toChartAccountResponse(account, parentName))
	}
	return responses, nil
}

func (r *Repository) LoadResponse(businessID string, account ChartAccount) (ChartAccountResponse, error) {
	parentName := ""
	if account.ParentAccountID != nil {
		_ = r.db.Table("chart_of_accounts").Select("account_name").Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, *account.ParentAccountID).Scan(&parentName).Error
	}
	return toChartAccountResponse(account, parentName), nil
}

func (r *Repository) CreatePaymentAccount(tx *gorm.DB, account *PaymentAccount) error {
	return tx.Create(account).Error
}

type defaultPaymentBranchRow struct {
	ID         string
	BranchName string
}

type defaultPaymentMethodRow struct {
	ID         string
	MethodName string
	MethodType string
}

func (r *Repository) ActiveBranches(tx *gorm.DB, businessID string) ([]defaultPaymentBranchRow, error) {
	var rows []defaultPaymentBranchRow
	err := tx.Table("branches").
		Select("id, branch_name").
		Where("business_id = ? AND status = ? AND deleted_at IS NULL", businessID, "active").
		Order("branch_name ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) FindChartAccountByCode(tx *gorm.DB, businessID, code string) (*ChartAccount, error) {
	var account ChartAccount
	err := tx.Where("business_id = ? AND account_code = ? AND status = ? AND deleted_at IS NULL", businessID, code, "active").First(&account).Error
	return &account, err
}

func (r *Repository) EnsurePaymentMethod(tx *gorm.DB, businessID, methodName, methodType string, isDefault, requiresReference bool) (*defaultPaymentMethodRow, error) {
	var row defaultPaymentMethodRow
	err := tx.Table("payment_methods").
		Select("id, method_name, method_type").
		Where("business_id = ? AND LOWER(method_name) = LOWER(?) AND deleted_at IS NULL", businessID, methodName).
		Take(&row).Error
	if err == nil {
		updates := map[string]interface{}{
			"method_type":                  methodType,
			"show_in_pos":                  true,
			"show_in_bakery_orders":        true,
			"show_in_dashboard_collection": true,
			"allow_split_payment":          true,
			"requires_reference":           requiresReference,
			"status":                       "active",
			"updated_at":                   time.Now().UTC(),
		}
		if methodType == "cash" || methodType == "bank_transfer" {
			updates["show_in_purchasing"] = true
			updates["show_in_expenses"] = true
		}
		if err := tx.Table("payment_methods").Where("id = ? AND business_id = ?", row.ID, businessID).Updates(updates).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	if isDefault {
		if err := tx.Table("payment_methods").Where("business_id = ? AND is_default = ? AND deleted_at IS NULL", businessID, true).Update("is_default", false).Error; err != nil {
			return nil, err
		}
	}
	id := utils.NewUUID()
	method := map[string]interface{}{
		"id":                           id,
		"business_id":                  businessID,
		"method_name":                  methodName,
		"method_type":                  methodType,
		"is_default":                   isDefault,
		"allow_split_payment":          true,
		"requires_reference":           requiresReference,
		"show_in_pos":                  true,
		"show_in_bakery_orders":        true,
		"show_in_purchasing":           methodType == "cash" || methodType == "bank_transfer",
		"show_in_expenses":             methodType == "cash" || methodType == "bank_transfer",
		"show_in_dashboard_collection": true,
		"status":                       "active",
		"created_at":                   time.Now().UTC(),
		"updated_at":                   time.Now().UTC(),
	}
	if err := tx.Table("payment_methods").Create(method).Error; err != nil {
		return nil, err
	}
	return &defaultPaymentMethodRow{ID: id, MethodName: methodName, MethodType: methodType}, nil
}

func (r *Repository) FindOrCreatePaymentAccount(tx *gorm.DB, businessID, branchID, accountName, accountType, chartAccountID, userID string) (*PaymentAccount, bool, error) {
	var account PaymentAccount
	err := tx.Where("business_id = ? AND branch_id = ? AND chart_account_id = ? AND deleted_at IS NULL", businessID, branchID, chartAccountID).First(&account).Error
	if err == nil {
		updates := map[string]interface{}{"account_type": accountType, "status": "active", "updated_by_user_id": userID, "updated_at": time.Now().UTC()}
		if err := tx.Model(&PaymentAccount{}).Where("id = ? AND business_id = ?", account.ID, businessID).Updates(updates).Error; err != nil {
			return nil, false, err
		}
		account.AccountType = accountType
		account.Status = "active"
		return &account, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, false, err
	}
	err = tx.Where("business_id = ? AND branch_id = ? AND LOWER(account_name) = LOWER(?) AND deleted_at IS NULL", businessID, branchID, accountName).First(&account).Error
	if err == nil {
		updates := map[string]interface{}{"account_type": accountType, "chart_account_id": chartAccountID, "status": "active", "updated_by_user_id": userID, "updated_at": time.Now().UTC()}
		if err := tx.Model(&PaymentAccount{}).Where("id = ? AND business_id = ?", account.ID, businessID).Updates(updates).Error; err != nil {
			return nil, false, err
		}
		account.AccountType = accountType
		account.ChartAccountID = chartAccountID
		account.Status = "active"
		return &account, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, false, err
	}
	account = PaymentAccount{
		ID:              utils.NewUUID(),
		BusinessID:      businessID,
		BranchID:        &branchID,
		AccountName:     accountName,
		AccountType:     accountType,
		ChartAccountID:  chartAccountID,
		Status:          "active",
		CreatedByUserID: &userID,
		UpdatedByUserID: &userID,
	}
	if err := tx.Create(&account).Error; err != nil {
		return nil, false, err
	}
	return &account, true, nil
}

func (r *Repository) UpsertPaymentMethodAccountMapping(tx *gorm.DB, businessID, branchID, methodID, accountID string) (bool, error) {
	var id string
	err := tx.Table("payment_method_account_mappings").
		Select("id").
		Where("business_id = ? AND branch_id = ? AND payment_method_id = ? AND deleted_at IS NULL", businessID, branchID, methodID).
		Take(&id).Error
	if err == nil {
		return false, tx.Table("payment_method_account_mappings").
			Where("id = ? AND business_id = ?", id, businessID).
			Updates(map[string]interface{}{"payment_account_id": accountID, "status": "active", "updated_at": time.Now().UTC()}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return false, err
	}
	return true, tx.Table("payment_method_account_mappings").Create(map[string]interface{}{
		"id":                 utils.NewUUID(),
		"business_id":        businessID,
		"branch_id":          branchID,
		"payment_method_id":  methodID,
		"payment_account_id": accountID,
		"status":             "active",
		"created_at":         time.Now().UTC(),
		"updated_at":         time.Now().UTC(),
	}).Error
}

func (r *Repository) ListPaymentAccounts(businessID string, query PaymentAccountListQuery) ([]PaymentAccount, int64, error) {
	db := r.db.Model(&PaymentAccount{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyPaymentAccountFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	sortOrder := "asc"
	if strings.ToLower(query.SortOrder) == "desc" {
		sortOrder = "desc"
	}
	var accounts []PaymentAccount
	err := db.Order(fmt.Sprintf("%s %s", safePaymentAccountSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&accounts).Error
	return accounts, total, err
}

func (r *Repository) FindPaymentAccountByID(businessID, id string) (*PaymentAccount, error) {
	var account PaymentAccount
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&account).Error
	return &account, err
}

func (r *Repository) PaymentAccountNameExists(businessID string, branchID *string, name, excludedID string) (bool, error) {
	query := r.db.Model(&PaymentAccount{}).
		Where("business_id = ? AND LOWER(account_name) = LOWER(?) AND deleted_at IS NULL", businessID, strings.TrimSpace(name))
	if branchID == nil || strings.TrimSpace(*branchID) == "" {
		query = query.Where("branch_id IS NULL")
	} else {
		query = query.Where("branch_id = ?", strings.TrimSpace(*branchID))
	}
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	var count int64
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) PaymentAccountChartExists(businessID string, branchID *string, chartAccountID, excludedID string) (bool, error) {
	query := r.db.Model(&PaymentAccount{}).
		Where("business_id = ? AND chart_account_id = ? AND deleted_at IS NULL", businessID, chartAccountID)
	if branchID == nil || strings.TrimSpace(*branchID) == "" {
		query = query.Where("branch_id IS NULL")
	} else {
		query = query.Where("branch_id = ?", strings.TrimSpace(*branchID))
	}
	if excludedID != "" {
		query = query.Where("id <> ?", excludedID)
	}
	var count int64
	err := query.Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdatePaymentAccount(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&PaymentAccount{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) CountPaymentMethodsUsingPaymentAccount(tx *gorm.DB, businessID, id string) (int64, error) {
	var count int64
	err := tx.Table("payment_methods").
		Where("business_id = ? AND default_payment_account_id = ? AND deleted_at IS NULL", businessID, id).
		Count(&count).Error
	return count, err
}

func (r *Repository) ValidateActiveAssetChartAccount(tx *gorm.DB, businessID, accountID string) (*ChartAccount, error) {
	var account ChartAccount
	err := tx.Where("business_id = ? AND id = ? AND account_type = ? AND status = ? AND deleted_at IS NULL", businessID, accountID, "asset", "active").First(&account).Error
	return &account, err
}

func (r *Repository) LoadPaymentAccountResponses(businessID string, accounts []PaymentAccount) ([]PaymentAccountResponse, error) {
	responses := make([]PaymentAccountResponse, 0, len(accounts))
	for _, account := range accounts {
		response, err := r.LoadPaymentAccountResponse(businessID, account)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadPaymentAccountResponse(businessID string, account PaymentAccount) (PaymentAccountResponse, error) {
	branchName := ""
	if account.BranchID != nil && *account.BranchID != "" {
		_ = r.db.Table("branches").Select("branch_name").Where("business_id = ? AND id = ?", businessID, *account.BranchID).Scan(&branchName).Error
	}
	var chart ChartAccount
	if err := r.db.Where("business_id = ? AND id = ?", businessID, account.ChartAccountID).First(&chart).Error; err != nil {
		return PaymentAccountResponse{}, err
	}
	balance, err := r.PaymentAccountCurrentBalance(businessID, account.ChartAccountID, account.BranchID)
	if err != nil {
		return PaymentAccountResponse{}, err
	}
	return toPaymentAccountResponse(account, branchName, chart, balance), nil
}

func (r *Repository) PaymentAccountCurrentBalance(businessID, chartAccountID string, branchID *string) (float64, error) {
	branchFilter := ""
	args := []interface{}{businessID, chartAccountID}
	if branchID != nil && strings.TrimSpace(*branchID) != "" {
		branchFilter = "AND je.branch_id = ?"
		args = append(args, strings.TrimSpace(*branchID))
	}
	var balance float64
	err := r.db.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.account_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  `+branchFilter+`
	`, args...).Scan(&balance).Error
	return roundMoney(balance), err
}

func (r *Repository) NextAccountTransferNumber(tx *gorm.DB, businessID string, transferDate time.Time) (string, error) {
	datePart := transferDate.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":account_transfers").Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "TRF-" + datePart + "-"
	if err := tx.Model(&AccountTransfer{}).Where("business_id = ? AND transfer_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) CreateAccountTransfer(tx *gorm.DB, transfer *AccountTransfer) error {
	return tx.Create(transfer).Error
}

func (r *Repository) UpdateAccountTransfer(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&AccountTransfer{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindAccountTransferByID(businessID, id string) (*AccountTransfer, error) {
	var transfer AccountTransfer
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&transfer).Error
	return &transfer, err
}

func (r *Repository) ListAccountTransfers(businessID string, query AccountTransferListQuery) ([]AccountTransfer, int64, error) {
	db := r.db.Model(&AccountTransfer{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyAccountTransferFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		order = "asc"
	}
	var transfers []AccountTransfer
	err := db.Order("transfer_date " + order + ", transfer_number " + order).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&transfers).Error
	return transfers, total, err
}

func (r *Repository) LoadAccountTransferResponses(businessID string, transfers []AccountTransfer) ([]AccountTransferResponse, error) {
	responses := make([]AccountTransferResponse, 0, len(transfers))
	for _, transfer := range transfers {
		response, err := r.LoadAccountTransferResponse(businessID, transfer)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadAccountTransferResponse(businessID string, transfer AccountTransfer) (AccountTransferResponse, error) {
	branchName := ""
	if transfer.BranchID != nil && *transfer.BranchID != "" {
		_ = r.db.Table("branches").Select("branch_name").Where("business_id = ? AND id = ?", businessID, *transfer.BranchID).Scan(&branchName).Error
	}
	fromName := r.paymentAccountName(businessID, transfer.FromPaymentAccountID)
	toName := r.paymentAccountName(businessID, transfer.ToPaymentAccountID)
	return AccountTransferResponse{
		ID:                     transfer.ID,
		BusinessID:             transfer.BusinessID,
		BranchID:               transfer.BranchID,
		BranchName:             branchName,
		TransferNumber:         transfer.TransferNumber,
		TransferDate:           transfer.TransferDate.Format("2006-01-02"),
		FromPaymentAccountID:   transfer.FromPaymentAccountID,
		FromPaymentAccountName: fromName,
		ToPaymentAccountID:     transfer.ToPaymentAccountID,
		ToPaymentAccountName:   toName,
		Amount:                 roundMoney(transfer.Amount),
		ReferenceNumber:        transfer.ReferenceNumber,
		Notes:                  transfer.Notes,
		Status:                 transfer.Status,
		JournalEntryID:         transfer.JournalEntryID,
		CreatedByUserID:        transfer.CreatedByUserID,
		CreatedAt:              transfer.CreatedAt,
		UpdatedAt:              transfer.UpdatedAt,
	}, nil
}

func (r *Repository) NextPlatformSettlementNumber(tx *gorm.DB, businessID string, settlementDate time.Time) (string, error) {
	datePart := settlementDate.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":platform_settlements").Error; err != nil {
		return "", err
	}
	var count int64
	prefix := "STL-" + datePart + "-"
	if err := tx.Model(&PlatformSettlement{}).Where("business_id = ? AND settlement_number LIKE ?", businessID, prefix+"%").Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%06d", prefix, count+1), nil
}

func (r *Repository) CreatePlatformSettlement(tx *gorm.DB, settlement *PlatformSettlement, deductions []PlatformSettlementDeduction) error {
	if err := tx.Create(settlement).Error; err != nil {
		return err
	}
	if len(deductions) == 0 {
		return nil
	}
	return tx.Create(&deductions).Error
}

func (r *Repository) UpdatePlatformSettlement(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&PlatformSettlement{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindPlatformSettlementByID(businessID, id string) (*PlatformSettlement, error) {
	var settlement PlatformSettlement
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&settlement).Error
	return &settlement, err
}

func (r *Repository) ListPlatformSettlements(businessID string, query PlatformSettlementListQuery) ([]PlatformSettlement, int64, error) {
	db := r.db.Model(&PlatformSettlement{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyPlatformSettlementFilters(db, query)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		order = "asc"
	}
	var settlements []PlatformSettlement
	err := db.Order("settlement_date " + order + ", settlement_number " + order).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&settlements).Error
	return settlements, total, err
}

func (r *Repository) LoadPlatformSettlementResponses(businessID string, settlements []PlatformSettlement) ([]PlatformSettlementResponse, error) {
	responses := make([]PlatformSettlementResponse, 0, len(settlements))
	for _, settlement := range settlements {
		response, err := r.LoadPlatformSettlementResponse(businessID, settlement)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadPlatformSettlementResponse(businessID string, settlement PlatformSettlement) (PlatformSettlementResponse, error) {
	branchName := ""
	if settlement.BranchID != nil && *settlement.BranchID != "" {
		_ = r.db.Table("branches").Select("branch_name").Where("business_id = ? AND id = ?", businessID, *settlement.BranchID).Scan(&branchName).Error
	}
	deductions, err := r.ListPlatformSettlementDeductions(businessID, settlement.ID)
	if err != nil {
		return PlatformSettlementResponse{}, err
	}
	return PlatformSettlementResponse{
		ID:                         settlement.ID,
		BusinessID:                 settlement.BusinessID,
		BranchID:                   settlement.BranchID,
		BranchName:                 branchName,
		SettlementNumber:           settlement.SettlementNumber,
		SettlementDate:             settlement.SettlementDate.Format("2006-01-02"),
		PlatformPaymentAccountID:   settlement.PlatformPaymentAccountID,
		PlatformPaymentAccountName: r.paymentAccountName(businessID, settlement.PlatformPaymentAccountID),
		DepositPaymentAccountID:    settlement.DepositPaymentAccountID,
		DepositPaymentAccountName:  r.paymentAccountName(businessID, settlement.DepositPaymentAccountID),
		GrossAmount:                roundMoney(settlement.GrossAmount),
		DeductionsTotal:            roundMoney(settlement.DeductionsTotal),
		NetReceivedAmount:          roundMoney(settlement.NetReceivedAmount),
		Deductions:                 deductions,
		ReferenceNumber:            settlement.ReferenceNumber,
		Notes:                      settlement.Notes,
		Status:                     settlement.Status,
		JournalEntryID:             settlement.JournalEntryID,
		CreatedByUserID:            settlement.CreatedByUserID,
		CreatedAt:                  settlement.CreatedAt,
		UpdatedAt:                  settlement.UpdatedAt,
	}, nil
}

func (r *Repository) ListPlatformSettlementDeductions(businessID, settlementID string) ([]PlatformSettlementDeductionResponse, error) {
	var deductions []PlatformSettlementDeductionResponse
	err := r.db.Table("platform_settlement_deductions psd").
		Select("psd.id, psd.expense_account_id, coa.account_code AS expense_account_code, coa.account_name AS expense_account_name, psd.deduction_type, COALESCE(psd.description, '') AS description, psd.amount").
		Joins("JOIN chart_of_accounts coa ON coa.id = psd.expense_account_id AND coa.business_id = psd.business_id").
		Where("psd.business_id = ? AND psd.platform_settlement_id = ? AND psd.deleted_at IS NULL", businessID, settlementID).
		Order("psd.created_at ASC, psd.id ASC").
		Scan(&deductions).Error
	for i := range deductions {
		deductions[i].Amount = roundMoney(deductions[i].Amount)
	}
	return deductions, err
}

func (r *Repository) paymentAccountName(businessID, accountID string) string {
	var name string
	_ = r.db.Table("payment_accounts").Select("account_name").Where("business_id = ? AND id = ?", businessID, accountID).Scan(&name).Error
	return name
}

func (r *Repository) LoadJournalEntryResponses(businessID string, entries []JournalEntry, includeLines bool) ([]JournalEntryResponse, error) {
	responses := make([]JournalEntryResponse, 0, len(entries))
	for _, entry := range entries {
		response, err := r.LoadJournalEntryResponse(businessID, entry, includeLines)
		if err != nil {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) LoadJournalEntryResponse(businessID string, entry JournalEntry, includeLines bool) (JournalEntryResponse, error) {
	branchName := ""
	if entry.BranchID != nil && *entry.BranchID != "" {
		_ = r.db.Table("branches").Select("branch_name").Where("business_id = ? AND id = ?", businessID, *entry.BranchID).Scan(&branchName).Error
	}
	response := toJournalEntryResponse(entry, branchName)
	if includeLines {
		lines, err := r.ListJournalEntryLines(businessID, entry.ID)
		if err != nil {
			return response, err
		}
		response.Lines = lines
	}
	return response, nil
}

func (r *Repository) ListJournalEntryLines(businessID, entryID string) ([]JournalEntryLineResponse, error) {
	var lines []JournalEntryLineResponse
	err := r.db.Table("journal_entry_lines jel").
		Select("jel.id, jel.journal_entry_id, jel.account_id, coa.account_code, coa.account_name, coa.account_type, jel.line_number, jel.debit_amount, jel.credit_amount, jel.description, jel.created_at, jel.updated_at").
		Joins("JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id").
		Where("jel.business_id = ? AND jel.journal_entry_id = ? AND jel.deleted_at IS NULL", businessID, entryID).
		Order("jel.line_number ASC").
		Scan(&lines).Error
	return lines, err
}

func (r *Repository) ListJournalEntryLinesForUpdate(tx *gorm.DB, businessID, entryID string) ([]JournalEntryLine, error) {
	var lines []JournalEntryLine
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("business_id = ? AND journal_entry_id = ? AND deleted_at IS NULL", businessID, entryID).
		Order("line_number ASC").
		Find(&lines).Error
	return lines, err
}

func (r *Repository) GeneralLedgerOpeningBalance(businessID string, query GeneralLedgerQuery) (float64, error) {
	where, args := ledgerWhereClause(businessID, query.AccountID, query.BranchID)
	args = append(args, query.DateFrom)
	var balance float64
	err := r.db.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		`+where+` AND je.entry_date < ?
	`, args...).Scan(&balance).Error
	return roundMoney(balance), err
}

func (r *Repository) GeneralLedgerPeriodTotals(businessID string, query GeneralLedgerQuery) (float64, float64, error) {
	where, args := ledgerWhereClause(businessID, query.AccountID, query.BranchID)
	args = append(args, query.DateFrom, query.DateTo)
	var totals struct {
		PeriodDebit  float64
		PeriodCredit float64
	}
	err := r.db.Raw(`
		SELECT COALESCE(SUM(jel.debit_amount), 0) AS period_debit,
		       COALESCE(SUM(jel.credit_amount), 0) AS period_credit
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		`+where+` AND je.entry_date >= ? AND je.entry_date <= ?
	`, args...).Scan(&totals).Error
	return roundMoney(totals.PeriodDebit), roundMoney(totals.PeriodCredit), err
}

func (r *Repository) CountGeneralLedgerRows(businessID string, query GeneralLedgerQuery) (int64, error) {
	where, args := ledgerWhereClause(businessID, query.AccountID, query.BranchID)
	args = append(args, query.DateFrom, query.DateTo)
	var total int64
	err := r.db.Raw(`
		SELECT COUNT(*)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		`+where+` AND je.entry_date >= ? AND je.entry_date <= ?
	`, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) ListGeneralLedgerRows(businessID string, query GeneralLedgerQuery, openingBalance float64) ([]GeneralLedgerRowResponse, error) {
	where, args := ledgerWhereClause(businessID, query.AccountID, query.BranchID)
	rawArgs := append([]interface{}{openingBalance}, args...)
	rawArgs = append(rawArgs, query.DateFrom, query.DateTo, (query.Page-1)*query.Limit, query.Limit)
	order := "ASC"
	if strings.ToLower(query.SortOrder) == "desc" {
		order = "DESC"
	}
	var rows []GeneralLedgerRowResponse
	err := r.db.Raw(`
		SELECT je.id AS entry_id,
		       je.entry_number,
		       TO_CHAR(je.entry_date, 'YYYY-MM-DD') AS entry_date,
		       je.branch_id,
		       COALESCE(b.branch_name, '') AS branch_name,
		       coa.id AS account_id,
		       coa.account_code,
		       coa.account_name,
		       coa.account_type,
		       coa.normal_balance,
		       COALESCE(je.reference_number, '') AS reference_number,
		       COALESCE(je.narration, '') AS narration,
		       COALESCE(jel.description, '') AS line_description,
		       COALESCE(je.source_type, '') AS source_type,
		       je.source_id,
		       jel.debit_amount,
		       jel.credit_amount,
		       ? + SUM(jel.debit_amount - jel.credit_amount) OVER (
		       	ORDER BY je.entry_date `+order+`, je.entry_number `+order+`, jel.line_number `+order+`, jel.id `+order+`
		       ) AS running_balance
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id
		LEFT JOIN branches b ON b.id = je.branch_id AND b.business_id = je.business_id
		`+where+` AND je.entry_date >= ? AND je.entry_date <= ?
		ORDER BY je.entry_date `+order+`, je.entry_number `+order+`, jel.line_number `+order+`, jel.id `+order+`
		OFFSET ? LIMIT ?
	`, rawArgs...).Scan(&rows).Error
	for i := range rows {
		rows[i].DebitAmount = roundMoney(rows[i].DebitAmount)
		rows[i].CreditAmount = roundMoney(rows[i].CreditAmount)
		rows[i].RunningBalance = roundMoney(rows[i].RunningBalance)
	}
	return rows, err
}

func (r *Repository) ListTrialBalanceRows(businessID string, query TrialBalanceQuery) ([]TrialBalanceRowResponse, error) {
	branchFilter := ""
	if strings.TrimSpace(query.BranchID) != "" {
		branchFilter = "AND je.branch_id = ?"
	}
	var rows []TrialBalanceRowResponse
	err := r.db.Raw(`
		WITH account_totals AS (
			SELECT jel.account_id,
			       COALESCE(SUM(CASE WHEN je.entry_date < ? THEN jel.debit_amount - jel.credit_amount ELSE 0 END), 0) AS opening_balance,
			       COALESCE(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ? THEN jel.debit_amount ELSE 0 END), 0) AS period_debit,
			       COALESCE(SUM(CASE WHEN je.entry_date >= ? AND je.entry_date <= ? THEN jel.credit_amount ELSE 0 END), 0) AS period_credit
			FROM journal_entry_lines jel
			JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
			WHERE jel.business_id = ?
			  AND jel.deleted_at IS NULL
			  AND je.deleted_at IS NULL
			  AND je.status IN ('posted', 'reversed')
			  `+branchFilter+`
			GROUP BY jel.account_id
		)
		SELECT coa.id AS account_id,
		       coa.account_code,
		       coa.account_name,
		       coa.account_type,
		       coa.account_group,
		       coa.normal_balance,
		       COALESCE(at.opening_balance, 0) AS opening_balance,
		       COALESCE(at.period_debit, 0) AS period_debit,
		       COALESCE(at.period_credit, 0) AS period_credit,
		       CASE WHEN COALESCE(at.opening_balance, 0) + COALESCE(at.period_debit, 0) - COALESCE(at.period_credit, 0) >= 0
		            THEN COALESCE(at.opening_balance, 0) + COALESCE(at.period_debit, 0) - COALESCE(at.period_credit, 0)
		            ELSE 0 END AS closing_debit,
		       CASE WHEN COALESCE(at.opening_balance, 0) + COALESCE(at.period_debit, 0) - COALESCE(at.period_credit, 0) < 0
		            THEN ABS(COALESCE(at.opening_balance, 0) + COALESCE(at.period_debit, 0) - COALESCE(at.period_credit, 0))
		            ELSE 0 END AS closing_credit
		FROM chart_of_accounts coa
		LEFT JOIN account_totals at ON at.account_id = coa.id
		WHERE coa.business_id = ?
		  AND (? = true OR ABS(COALESCE(at.opening_balance, 0)) > 0.004 OR ABS(COALESCE(at.period_debit, 0)) > 0.004 OR ABS(COALESCE(at.period_credit, 0)) > 0.004)
		ORDER BY coa.account_code ASC
	`, trialBalanceArgs(businessID, query, branchFilter != "")...).Scan(&rows).Error
	for i := range rows {
		rows[i].OpeningBalance = roundMoney(rows[i].OpeningBalance)
		rows[i].PeriodDebit = roundMoney(rows[i].PeriodDebit)
		rows[i].PeriodCredit = roundMoney(rows[i].PeriodCredit)
		rows[i].ClosingDebit = roundMoney(rows[i].ClosingDebit)
		rows[i].ClosingCredit = roundMoney(rows[i].ClosingCredit)
	}
	return rows, err
}

func (r *Repository) ListProfitLossRows(businessID string, query ProfitLossQuery) ([]ProfitLossAccountRowResponse, error) {
	branchFilter := ""
	if strings.TrimSpace(query.BranchID) != "" {
		branchFilter = "AND je.branch_id = ?"
	}
	var rows []ProfitLossAccountRowResponse
	err := r.db.Raw(`
		SELECT coa.id AS account_id,
		       coa.account_code,
		       coa.account_name,
		       coa.account_type,
		       coa.account_group,
		       CASE
		       	WHEN coa.account_type = 'income' THEN COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
		       	WHEN coa.account_type IN ('cogs', 'expense') THEN COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		       	ELSE 0
		       END AS amount
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date >= ?
		  AND je.entry_date <= ?
		  AND coa.account_type IN ('income', 'cogs', 'expense')
		  `+branchFilter+`
		GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.account_group
		HAVING ABS(CASE
		       	WHEN coa.account_type = 'income' THEN COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
		       	WHEN coa.account_type IN ('cogs', 'expense') THEN COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		       	ELSE 0
		       END) > 0.004
		ORDER BY CASE coa.account_type WHEN 'income' THEN 1 WHEN 'cogs' THEN 2 WHEN 'expense' THEN 3 ELSE 4 END,
		         coa.account_code ASC
	`, profitLossArgs(businessID, query, branchFilter != "")...).Scan(&rows).Error
	for i := range rows {
		rows[i].Amount = roundMoney(rows[i].Amount)
	}
	return rows, err
}

func (r *Repository) ListBalanceSheetRows(businessID string, query BalanceSheetQuery) ([]BalanceSheetAccountRowResponse, error) {
	branchFilter := ""
	if strings.TrimSpace(query.BranchID) != "" {
		branchFilter = "AND je.branch_id = ?"
	}
	var rows []BalanceSheetAccountRowResponse
	err := r.db.Raw(`
		SELECT coa.id AS account_id,
		       coa.account_code,
		       coa.account_name,
		       coa.account_type,
		       coa.account_group,
		       CASE
		       	WHEN coa.account_type = 'asset' THEN COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		       	WHEN coa.account_type IN ('liability', 'equity') THEN COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
		       	ELSE 0
		       END AS amount
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		JOIN chart_of_accounts coa ON coa.id = jel.account_id AND coa.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date <= ?
		  AND coa.account_type IN ('asset', 'liability', 'equity')
		  `+branchFilter+`
		GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.account_group
		HAVING ABS(CASE
		       	WHEN coa.account_type = 'asset' THEN COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
		       	WHEN coa.account_type IN ('liability', 'equity') THEN COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
		       	ELSE 0
		       END) > 0.004
		ORDER BY CASE coa.account_type WHEN 'asset' THEN 1 WHEN 'liability' THEN 2 WHEN 'equity' THEN 3 ELSE 4 END,
		         coa.account_code ASC
	`, balanceSheetArgs(businessID, query, branchFilter != "")...).Scan(&rows).Error
	for i := range rows {
		rows[i].Amount = roundMoney(rows[i].Amount)
	}
	return rows, err
}

func (r *Repository) LedgerBalanceForAccount(businessID, accountID, normalBalance, branchID, asOfDate string) (float64, error) {
	branchFilter := ""
	args := []interface{}{strings.TrimSpace(normalBalance), businessID, accountID, asOfDate}
	if strings.TrimSpace(branchID) != "" {
		branchFilter = "AND je.branch_id = ?"
		args = append(args, strings.TrimSpace(branchID))
	}
	var balance float64
	err := r.db.Raw(`
		SELECT COALESCE(SUM(
			CASE WHEN ? = 'credit'
				THEN jel.credit_amount - jel.debit_amount
				ELSE jel.debit_amount - jel.credit_amount
			END
		), 0)
		FROM journal_entry_lines jel
		JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.business_id = jel.business_id
		WHERE jel.business_id = ?
		  AND jel.account_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')
		  AND je.entry_date <= ?
		  `+branchFilter+`
	`, args...).Scan(&balance).Error
	return roundMoney(balance), err
}

func (r *Repository) SumInventoryOperationalValue(businessID, branchID string) (float64, error) {
	var total float64
	db := r.db.Table("inventory_items").
		Select("COALESCE(SUM(inventory_value), 0)").
		Where("business_id = ? AND deleted_at IS NULL", businessID)
	if strings.TrimSpace(branchID) != "" {
		db = db.Where("branch_id = ?", strings.TrimSpace(branchID))
	}
	err := db.Scan(&total).Error
	return roundMoney(total), err
}

func (r *Repository) SumAccountsPayableOperational(businessID, branchID string) (float64, error) {
	var total float64
	db := r.db.Table("purchase_invoices").
		Select("COALESCE(SUM(balance_amount), 0)").
		Where("business_id = ? AND deleted_at IS NULL AND status = ? AND payment_status <> ? AND balance_amount > 0", businessID, "posted", "paid")
	if strings.TrimSpace(branchID) != "" {
		db = db.Where("branch_id = ?", strings.TrimSpace(branchID))
	}
	err := db.Scan(&total).Error
	return roundMoney(total), err
}

func (r *Repository) SumAccountsReceivableOperational(businessID, branchID string) (float64, error) {
	var posTotal float64
	posDB := r.db.Table("sales").
		Select("COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0)").
		Where("business_id = ? AND deleted_at IS NULL AND sale_status = ? AND payment_status <> ?", businessID, "completed", "paid")
	if strings.TrimSpace(branchID) != "" {
		posDB = posDB.Where("branch_id = ?", strings.TrimSpace(branchID))
	}
	if err := posDB.Scan(&posTotal).Error; err != nil {
		return 0, err
	}
	var bakeryTotal float64
	bakeryDB := r.db.Table("bakery_orders").
		Select("COALESCE(SUM(balance_amount), 0)").
		Where("business_id = ? AND deleted_at IS NULL AND order_status = ? AND payment_status <> ? AND balance_amount > 0", businessID, "completed", "paid")
	if strings.TrimSpace(branchID) != "" {
		bakeryDB = bakeryDB.Where("branch_id = ?", strings.TrimSpace(branchID))
	}
	if err := bakeryDB.Scan(&bakeryTotal).Error; err != nil {
		return 0, err
	}
	return roundMoney(posTotal + bakeryTotal), nil
}

func (r *Repository) ListPaymentAccountReconciliationRows(businessID, branchID string) ([]PaymentAccountReconciliationItem, error) {
	var rows []PaymentAccountReconciliationItem
	db := r.db.Table("payment_accounts pa").
		Select(`pa.id AS payment_account_id,
			pa.account_name AS payment_account_name,
			pa.account_type,
			pa.branch_id,
			COALESCE(b.branch_name, '') AS branch_name,
			coa.id AS chart_account_id,
			coa.account_code AS chart_account_code,
			coa.account_name AS chart_account_name,
			0::numeric AS ledger_amount,
			'ledger_only' AS status,
			'Payment accounts do not store a separate operational balance yet; compare using the linked chart account ledger.' AS notes`).
		Joins("JOIN chart_of_accounts coa ON coa.id = pa.chart_account_id AND coa.business_id = pa.business_id AND coa.deleted_at IS NULL").
		Joins("LEFT JOIN branches b ON b.id = pa.branch_id AND b.business_id = pa.business_id").
		Where("pa.business_id = ? AND pa.deleted_at IS NULL AND pa.status = ?", businessID, "active")
	if strings.TrimSpace(branchID) != "" {
		db = db.Where("(pa.branch_id = ? OR pa.branch_id IS NULL)", strings.TrimSpace(branchID))
	}
	err := db.Order("pa.account_name ASC").Scan(&rows).Error
	return rows, err
}

func ledgerWhereClause(businessID, accountID, branchID string) (string, []interface{}) {
	where := `WHERE jel.business_id = ?
		  AND jel.deleted_at IS NULL
		  AND je.deleted_at IS NULL
		  AND je.status IN ('posted', 'reversed')`
	args := []interface{}{businessID}
	if strings.TrimSpace(accountID) != "" {
		where += " AND jel.account_id = ?"
		args = append(args, accountID)
	}
	if strings.TrimSpace(branchID) != "" {
		where += " AND je.branch_id = ?"
		args = append(args, branchID)
	}
	return where, args
}

func trialBalanceArgs(businessID string, query TrialBalanceQuery, hasBranchFilter bool) []interface{} {
	args := []interface{}{query.DateFrom, query.DateFrom, query.DateTo, query.DateFrom, query.DateTo, businessID}
	if hasBranchFilter {
		args = append(args, query.BranchID)
	}
	args = append(args, businessID, query.IncludeZeroBalances)
	return args
}

func profitLossArgs(businessID string, query ProfitLossQuery, hasBranchFilter bool) []interface{} {
	args := []interface{}{businessID, query.DateFrom, query.DateTo}
	if hasBranchFilter {
		args = append(args, query.BranchID)
	}
	return args
}

func balanceSheetArgs(businessID string, query BalanceSheetQuery, hasBranchFilter bool) []interface{} {
	args := []interface{}{businessID, query.AsOfDate}
	if hasBranchFilter {
		args = append(args, query.BranchID)
	}
	return args
}

func applyChartAccountFilters(db *gorm.DB, query ChartAccountListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		db = db.Where("LOWER(account_code) LIKE ? OR LOWER(account_name) LIKE ? OR LOWER(description) LIKE ?", like, like, like)
	}
	if query.AccountType != "" {
		db = db.Where("account_type = ?", query.AccountType)
	}
	if query.AccountGroup != "" {
		db = db.Where("account_group = ?", query.AccountGroup)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.ParentAccountID != "" {
		db = db.Where("parent_account_id = ?", query.ParentAccountID)
	}
	return db
}

func applyPaymentAccountFilters(db *gorm.DB, query PaymentAccountListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		db = db.Where("LOWER(account_name) LIKE ? OR LOWER(description) LIKE ?", like, like)
	}
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.AccountType != "" {
		db = db.Where("account_type = ?", query.AccountType)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	return db
}

func applyAccountTransferFilters(db *gorm.DB, query AccountTransferListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.PaymentAccountID != "" {
		db = db.Where("(from_payment_account_id = ? OR to_payment_account_id = ?)", query.PaymentAccountID, query.PaymentAccountID)
	}
	if query.DateFrom != "" {
		db = db.Where("transfer_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("transfer_date <= ?", query.DateTo)
	}
	return db
}

func applyPlatformSettlementFilters(db *gorm.DB, query PlatformSettlementListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.PlatformPaymentAccountID != "" {
		db = db.Where("platform_payment_account_id = ?", query.PlatformPaymentAccountID)
	}
	if query.DepositPaymentAccountID != "" {
		db = db.Where("deposit_payment_account_id = ?", query.DepositPaymentAccountID)
	}
	if query.DateFrom != "" {
		db = db.Where("settlement_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("settlement_date <= ?", query.DateTo)
	}
	return db
}

func applyJournalEntryFilters(db *gorm.DB, query JournalEntryListQuery) *gorm.DB {
	if query.Search != "" {
		like := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		db = db.Where("LOWER(entry_number) LIKE ? OR LOWER(reference_number) LIKE ? OR LOWER(narration) LIKE ?", like, like, like)
	}
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	switch query.JournalOrigin {
	case "manual":
		db = db.Where("source_type = ?", "manual")
	case "system":
		db = db.Where("COALESCE(source_type, '') <> ?", "manual")
	case "":
	}
	if query.JournalOrigin == "" && query.SourceType != "" {
		db = db.Where("source_type = ?", query.SourceType)
	}
	if query.DateFrom != "" {
		db = db.Where("entry_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("entry_date <= ?", query.DateTo)
	}
	return db
}

func safeChartAccountSortBy(value string) string {
	switch value {
	case "account_code", "account_name", "account_type", "account_group", "status", "updated_at", "created_at":
		return value
	default:
		return "account_code"
	}
}

func safePaymentAccountSortBy(value string) string {
	switch value {
	case "account_name", "account_type", "status", "updated_at", "created_at":
		return value
	default:
		return "account_name"
	}
}

func safeJournalEntrySortBy(value string) string {
	switch value {
	case "entry_number", "entry_date", "status", "total_debit", "total_credit", "created_at", "updated_at":
		return value
	default:
		return "entry_date"
	}
}

func normalizePagination(page, limit int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	return page, limit
}

func totalPages(total int64, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

func toChartAccountResponse(account ChartAccount, parentName string) ChartAccountResponse {
	return ChartAccountResponse{
		ID:                 account.ID,
		BusinessID:         account.BusinessID,
		ParentAccountID:    account.ParentAccountID,
		ParentAccountName:  parentName,
		AccountCode:        account.AccountCode,
		AccountName:        account.AccountName,
		AccountType:        account.AccountType,
		AccountGroup:       account.AccountGroup,
		NormalBalance:      account.NormalBalance,
		Description:        account.Description,
		IsSystemAccount:    account.IsSystemAccount,
		IsControlAccount:   account.IsControlAccount,
		AllowManualPosting: account.AllowManualPosting,
		Status:             account.Status,
		CreatedAt:          account.CreatedAt,
		UpdatedAt:          account.UpdatedAt,
	}
}

func toPaymentAccountResponse(account PaymentAccount, branchName string, chart ChartAccount, currentBalance float64) PaymentAccountResponse {
	return PaymentAccountResponse{
		ID:               account.ID,
		BusinessID:       account.BusinessID,
		BranchID:         account.BranchID,
		BranchName:       branchName,
		AccountName:      account.AccountName,
		AccountType:      account.AccountType,
		ChartAccountID:   account.ChartAccountID,
		ChartAccountCode: chart.AccountCode,
		ChartAccountName: chart.AccountName,
		ChartAccountType: chart.AccountType,
		Description:      account.Description,
		CurrentBalance:   roundMoney(absMoney(currentBalance)),
		BalanceLabel:     balanceLabel(currentBalance),
		Status:           account.Status,
		CreatedAt:        account.CreatedAt,
		UpdatedAt:        account.UpdatedAt,
	}
}

func toJournalEntryResponse(entry JournalEntry, branchName string) JournalEntryResponse {
	return JournalEntryResponse{
		ID:               entry.ID,
		BusinessID:       entry.BusinessID,
		BranchID:         entry.BranchID,
		BranchName:       branchName,
		EntryNumber:      entry.EntryNumber,
		EntryDate:        entry.EntryDate.Format("2006-01-02"),
		ReferenceNumber:  entry.ReferenceNumber,
		SourceType:       entry.SourceType,
		SourceID:         entry.SourceID,
		Narration:        entry.Narration,
		Status:           entry.Status,
		TotalDebit:       roundMoney(entry.TotalDebit),
		TotalCredit:      roundMoney(entry.TotalCredit),
		PostedAt:         entry.PostedAt,
		PostedByUserID:   entry.PostedByUserID,
		ReversedEntryID:  entry.ReversedEntryID,
		ReversedAt:       entry.ReversedAt,
		ReversedByUserID: entry.ReversedByUserID,
		CreatedByUserID:  entry.CreatedByUserID,
		UpdatedByUserID:  entry.UpdatedByUserID,
		CreatedAt:        entry.CreatedAt,
		UpdatedAt:        entry.UpdatedAt,
	}
}

func roundMoney(value float64) float64 {
	return math.Round(value*100) / 100
}
