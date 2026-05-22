package accounting

import (
	"fmt"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
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
	if query.SourceType != "" {
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
