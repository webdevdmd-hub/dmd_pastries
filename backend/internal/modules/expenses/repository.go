package expenses

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/accounting"
	"pastries-pos/internal/shared/utils"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(tx *gorm.DB, expense *Expense) error {
	return tx.Create(expense).Error
}

func (r *Repository) Update(tx *gorm.DB, businessID, id string, updates map[string]interface{}) error {
	result := tx.Model(&Expense{}).Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) FindByID(businessID, id string) (*Expense, error) {
	var expense Expense
	err := r.db.Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&expense).Error
	return &expense, err
}

func (r *Repository) FindByIDForUpdate(tx *gorm.DB, businessID, id string) (*Expense, error) {
	var expense Expense
	err := tx.Set("gorm:query_option", "FOR UPDATE").Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, id).First(&expense).Error
	return &expense, err
}

func (r *Repository) List(businessID string, query ExpenseListQuery) ([]Expense, int64, error) {
	db := r.db.Model(&Expense{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	db = applyFilters(db, query)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortOrder := "desc"
	if strings.ToLower(query.SortOrder) == "asc" {
		sortOrder = "asc"
	}
	var expenses []Expense
	err := db.Order(fmt.Sprintf("%s %s", safeSortBy(query.SortBy), sortOrder)).
		Offset((query.Page - 1) * query.Limit).
		Limit(query.Limit).
		Find(&expenses).Error
	return expenses, total, err
}

func (r *Repository) LoadResponse(businessID string, expense Expense) (ExpenseResponse, error) {
	responses, err := r.LoadResponses(businessID, []Expense{expense})
	if err != nil {
		return ExpenseResponse{}, err
	}
	if len(responses) == 0 {
		return ExpenseResponse{}, nil
	}
	return responses[0], nil
}

func (r *Repository) LoadResponses(businessID string, expenses []Expense) ([]ExpenseResponse, error) {
	responses := make([]ExpenseResponse, 0, len(expenses))
	if len(expenses) == 0 {
		return responses, nil
	}

	branchIDs := make([]string, 0)
	accountIDs := make([]string, 0)
	supplierIDs := make([]string, 0)
	customerIDs := make([]string, 0)
	userIDs := make([]string, 0)
	seen := map[string]struct{}{}
	add := func(value string, dest *[]string) {
		if strings.TrimSpace(value) == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		*dest = append(*dest, value)
	}
	for _, expense := range expenses {
		add(expense.BranchID, &branchIDs)
		add(expense.ExpenseAccountID, &accountIDs)
		add(expense.PaidThroughAccountID, &accountIDs)
		add(expense.CreatedByUserID, &userIDs)
		if expense.SupplierID != nil {
			add(*expense.SupplierID, &supplierIDs)
		}
		if expense.CustomerID != nil {
			add(*expense.CustomerID, &customerIDs)
		}
		if expense.UpdatedByUserID != nil {
			add(*expense.UpdatedByUserID, &userIDs)
		}
		if expense.VoidedByUserID != nil {
			add(*expense.VoidedByUserID, &userIDs)
		}
	}

	branchNames := map[string]string{}
	if len(branchIDs) > 0 {
		var rows []struct {
			ID         string
			BranchName string
		}
		if err := r.db.Table("branches").Select("id, branch_name").Where("business_id = ? AND id IN ?", businessID, branchIDs).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			branchNames[row.ID] = row.BranchName
		}
	}

	accounts := map[string]accounting.ChartAccount{}
	if len(accountIDs) > 0 {
		var rows []accounting.ChartAccount
		if err := r.db.Where("business_id = ? AND id IN ?", businessID, accountIDs).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			accounts[row.ID] = row
		}
	}

	supplierNames := map[string]string{}
	if len(supplierIDs) > 0 {
		var rows []struct {
			ID           string
			SupplierName string
		}
		if err := r.db.Table("suppliers").Select("id, supplier_name").Where("business_id = ? AND id IN ?", businessID, supplierIDs).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			supplierNames[row.ID] = row.SupplierName
		}
	}

	customerNames := map[string]string{}
	if len(customerIDs) > 0 {
		var rows []struct {
			ID       string
			FullName string
		}
		if err := r.db.Table("customers").Select("id, full_name").Where("business_id = ? AND id IN ?", businessID, customerIDs).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			customerNames[row.ID] = row.FullName
		}
	}

	userNames := map[string]string{}
	if len(userIDs) > 0 {
		var rows []struct {
			ID       string
			FullName string
		}
		if err := r.db.Table("users").Select("id, full_name").Where("business_id = ? AND id IN ?", businessID, userIDs).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			userNames[row.ID] = row.FullName
		}
	}

	for _, expense := range expenses {
		expenseAccount := accounts[expense.ExpenseAccountID]
		paidAccount := accounts[expense.PaidThroughAccountID]
		response := ExpenseResponse{
			ID:                     expense.ID,
			BusinessID:             expense.BusinessID,
			BranchID:               expense.BranchID,
			BranchName:             branchNames[expense.BranchID],
			ExpenseNumber:          expense.ExpenseNumber,
			ExpenseDate:            expense.ExpenseDate.Format("2006-01-02"),
			ExpenseAccountID:       expense.ExpenseAccountID,
			ExpenseAccountCode:     expenseAccount.AccountCode,
			ExpenseAccountName:     expenseAccount.AccountName,
			PaidThroughAccountID:   expense.PaidThroughAccountID,
			PaidThroughAccountCode: paidAccount.AccountCode,
			PaidThroughAccountName: paidAccount.AccountName,
			SupplierID:             expense.SupplierID,
			CustomerID:             expense.CustomerID,
			Amount:                 expense.Amount.Round2(),
			ReferenceNumber:        expense.ReferenceNumber,
			Notes:                  expense.Notes,
			ReceiptFileID:          expense.ReceiptFileID,
			IsBillable:             expense.IsBillable,
			Status:                 expense.Status,
			JournalEntryID:         expense.JournalEntryID,
			ReversalJournalEntryID: expense.ReversalJournalEntryID,
			CreatedByUserID:        expense.CreatedByUserID,
			CreatedByUserName:      userNames[expense.CreatedByUserID],
			UpdatedByUserID:        expense.UpdatedByUserID,
			VoidedByUserID:         expense.VoidedByUserID,
			VoidedAt:               expense.VoidedAt,
			CreatedAt:              expense.CreatedAt,
			UpdatedAt:              expense.UpdatedAt,
		}
		if expense.SupplierID != nil {
			response.SupplierName = supplierNames[*expense.SupplierID]
		}
		if expense.CustomerID != nil {
			response.CustomerName = customerNames[*expense.CustomerID]
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func (r *Repository) NextExpenseNumber(tx *gorm.DB, businessID string, expenseDate time.Time) (string, error) {
	datePart := expenseDate.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":expenses").Error; err != nil {
		return "", err
	}
	prefix := "EXP-" + datePart + "-"
	return utils.NextSequentialNumber(tx.Table("expenses").Where("business_id = ?", businessID), "expense_number", prefix, 6)
}

func (r *Repository) NextJournalEntryNumber(tx *gorm.DB, businessID string, entryDate time.Time) (string, error) {
	datePart := entryDate.Format("20060102")
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", businessID+":"+datePart+":journal_entries").Error; err != nil {
		return "", err
	}
	prefix := "JV-" + datePart + "-"
	return utils.NextSequentialNumber(tx.Table("journal_entries").Where("business_id = ?", businessID), "entry_number", prefix, 6)
}

func (r *Repository) CreateJournalEntry(tx *gorm.DB, entry *accounting.JournalEntry, lines []accounting.JournalEntryLine) error {
	if err := tx.Create(entry).Error; err != nil {
		return err
	}
	return tx.Create(&lines).Error
}

func (r *Repository) FindJournalLines(tx *gorm.DB, businessID, entryID string) ([]accounting.JournalEntryLine, error) {
	var lines []accounting.JournalEntryLine
	err := tx.Where("business_id = ? AND journal_entry_id = ? AND deleted_at IS NULL", businessID, entryID).Order("line_number ASC").Find(&lines).Error
	return lines, err
}

func (r *Repository) MarkJournalReversed(tx *gorm.DB, businessID, entryID, reversalEntryID, userID string, reversedAt time.Time) error {
	result := tx.Model(&accounting.JournalEntry{}).
		Where("business_id = ? AND id = ? AND deleted_at IS NULL", businessID, entryID).
		Updates(map[string]interface{}{
			"status":              "reversed",
			"reversed_entry_id":   reversalEntryID,
			"reversed_at":         reversedAt,
			"reversed_by_user_id": userID,
			"updated_by_user_id":  userID,
			"updated_at":          reversedAt,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ListExpenseJournalEntryIDs(tx *gorm.DB, businessID, expenseID string) ([]string, error) {
	var ids []string
	err := tx.Model(&accounting.JournalEntry{}).
		Where("business_id = ? AND source_id = ? AND source_type IN ?",
			businessID,
			expenseID,
			[]string{"expense", "expense_update_reversal", "expense_void_reversal"},
		).
		Pluck("id", &ids).Error
	return ids, err
}

func (r *Repository) SoftDeleteExpense(tx *gorm.DB, businessID, id string) error {
	result := tx.Where("business_id = ? AND id = ?", businessID, id).Delete(&Expense{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// SoftDeleteJournalEntries removes an expense's journals from the books while
// keeping the rows for the audit trail (safe-delete policy: deletions must
// never physically destroy posted ledger history). The partial unique indexes
// on journal_entries all carry WHERE deleted_at IS NULL, so retained rows
// cannot collide with future entry numbers or source idempotency.
func (r *Repository) SoftDeleteJournalEntries(tx *gorm.DB, businessID string, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	if err := tx.Where("business_id = ? AND journal_entry_id IN ?", businessID, ids).Delete(&accounting.JournalEntryLine{}).Error; err != nil {
		return err
	}
	return tx.Where("business_id = ? AND id IN ?", businessID, ids).Delete(&accounting.JournalEntry{}).Error
}

func (r *Repository) ValidateBranch(tx *gorm.DB, businessID, branchID string) error {
	var count int64
	err := tx.Table("branches").Where("business_id = ? AND id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, "active").Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateSupplier(tx *gorm.DB, businessID, branchID, supplierID string) error {
	var count int64
	err := tx.Table("suppliers").Where("business_id = ? AND branch_id = ? AND id = ? AND deleted_at IS NULL", businessID, branchID, supplierID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *Repository) ValidateCustomer(tx *gorm.DB, businessID, branchID, customerID string) error {
	var count int64
	err := tx.Table("customers").Where("business_id = ? AND branch_id = ? AND id = ? AND deleted_at IS NULL", businessID, branchID, customerID).Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// Chart accounts are branch-scoped since migration 000092, so an expense must
// be booked against an account belonging to its own branch.
// FindPostedJournalBySource makes expense posting idempotent: a retry returns
// the entry already posted for that expense instead of creating a second one.
func (r *Repository) FindPostedJournalBySource(tx *gorm.DB, businessID, sourceType, sourceID string) (*accounting.JournalEntry, error) {
	var entry accounting.JournalEntry
	err := tx.Where("business_id = ? AND source_type = ? AND source_id = ? AND status IN ? AND deleted_at IS NULL",
		businessID, sourceType, sourceID, []string{"posted", "reversed"}).
		First(&entry).Error
	return &entry, err
}

func (r *Repository) ValidateAccount(tx *gorm.DB, businessID, branchID, accountID string) (*accounting.ChartAccount, error) {
	var account accounting.ChartAccount
	err := tx.Where("business_id = ? AND branch_id = ? AND id = ? AND status = ? AND deleted_at IS NULL", businessID, branchID, accountID, "active").First(&account).Error
	return &account, err
}

func (r *Repository) ValidatePaidThroughPaymentAccount(tx *gorm.DB, businessID, branchID, accountID string) (*accounting.ChartAccount, error) {
	var account accounting.ChartAccount
	err := tx.Table("chart_of_accounts AS coa").
		Select("coa.*").
		Joins("JOIN payment_accounts pa ON pa.business_id = coa.business_id AND pa.chart_account_id = coa.id AND pa.deleted_at IS NULL").
		Where("coa.business_id = ? AND coa.id = ? AND coa.account_type = ? AND coa.status = ? AND coa.allow_manual_posting = ? AND coa.deleted_at IS NULL", businessID, accountID, "asset", "active", true).
		Where("pa.status = ?", "active").
		Where("pa.account_type IN ?", []string{"cash", "bank", "card_clearing", "platform_clearing", "wallet", "other"}).
		Where("(pa.branch_id IS NULL OR pa.branch_id = ?)", branchID).
		Where("coa.branch_id = ?", branchID).
		First(&account).Error
	return &account, err
}

func applyFilters(db *gorm.DB, query ExpenseListQuery) *gorm.DB {
	if query.BranchID != "" {
		db = db.Where("branch_id = ?", query.BranchID)
	}
	if query.ExpenseAccountID != "" {
		db = db.Where("expense_account_id = ?", query.ExpenseAccountID)
	}
	if query.PaidThroughAccountID != "" {
		db = db.Where("paid_through_account_id = ?", query.PaidThroughAccountID)
	}
	if query.SupplierID != "" {
		db = db.Where("supplier_id = ?", query.SupplierID)
	}
	if query.CustomerID != "" {
		db = db.Where("customer_id = ?", query.CustomerID)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.DateFrom != "" {
		db = db.Where("expense_date >= ?", query.DateFrom)
	}
	if query.DateTo != "" {
		db = db.Where("expense_date <= ?", query.DateTo)
	}
	if strings.TrimSpace(query.Search) != "" {
		search := "%" + strings.ToLower(strings.TrimSpace(query.Search)) + "%"
		db = db.Where("LOWER(expense_number) LIKE ? OR LOWER(reference_number) LIKE ? OR LOWER(notes) LIKE ?", search, search, search)
	}
	return db
}

func safeSortBy(sortBy string) string {
	switch strings.ToLower(strings.TrimSpace(sortBy)) {
	case "expense_number", "expense_date", "amount", "status", "created_at", "updated_at":
		return sortBy
	default:
		return "expense_date"
	}
}
