package accounting

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo}
}

func (s *Service) ListChartAccounts(currentUser *utils.AuthContext, query ChartAccountListQuery) (*PaginatedResponse[ChartAccountResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	if err := validateChartAccountFilters(query); err != nil {
		return nil, err
	}
	accounts, total, err := s.repo.List(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list chart of accounts")
	}
	items, err := s.repo.LoadResponses(currentUser.BusinessID, accounts)
	if err != nil {
		return nil, apperrors.Internal("failed to load chart of account details")
	}
	return &PaginatedResponse[ChartAccountResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) SeedDefaults(currentUser *utils.AuthContext, ipAddress, userAgent string) error {
	return s.withTransaction(func(tx *gorm.DB) error {
		if err := SeedDefaultChartOfAccounts(tx, currentUser.BusinessID); err != nil {
			return apperrors.Internal("failed to seed chart of accounts")
		}
		return s.writeAudit(tx, currentUser, "accounting.chart_accounts_seeded", currentUser.BusinessID, "Chart of accounts defaults seeded.", ipAddress, userAgent)
	})
}

func (s *Service) CreateChartAccount(currentUser *utils.AuthContext, req CreateChartAccountRequest, ipAddress, userAgent string) (*ChartAccountResponse, error) {
	if err := validateCreateChartAccountRequest(req); err != nil {
		return nil, err
	}
	allowManualPosting := true
	if req.AllowManualPosting != nil {
		allowManualPosting = *req.AllowManualPosting
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		exists, err := s.repo.AccountCodeExists(tx, currentUser.BusinessID, strings.TrimSpace(req.AccountCode))
		if err != nil {
			return apperrors.Internal("failed to validate account code")
		}
		if exists {
			return apperrors.Conflict("account_code already exists", nil)
		}
		if err := s.validateParentAccount(currentUser.BusinessID, cleanStringPointer(req.ParentAccountID), ""); err != nil {
			return err
		}
		account := &ChartAccount{
			ID:                 utils.NewUUID(),
			BusinessID:         currentUser.BusinessID,
			ParentAccountID:    cleanStringPointer(req.ParentAccountID),
			AccountCode:        strings.TrimSpace(req.AccountCode),
			AccountName:        strings.TrimSpace(req.AccountName),
			AccountType:        strings.TrimSpace(req.AccountType),
			AccountGroup:       strings.TrimSpace(req.AccountGroup),
			NormalBalance:      strings.TrimSpace(req.NormalBalance),
			Description:        strings.TrimSpace(req.Description),
			IsSystemAccount:    false,
			IsControlAccount:   req.IsControlAccount,
			AllowManualPosting: allowManualPosting,
			Status:             "active",
			CreatedByUserID:    &currentUser.UserID,
			UpdatedByUserID:    &currentUser.UserID,
		}
		if err := s.repo.Create(tx, account); err != nil {
			return apperrors.Internal("failed to create chart account")
		}
		createdID = account.ID
		return s.writeAudit(tx, currentUser, "accounting.chart_account_created", account.ID, "Chart account created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetChartAccount(currentUser, createdID)
}

func (s *Service) GetChartAccount(currentUser *utils.AuthContext, id string) (*ChartAccountResponse, error) {
	account, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapChartAccountNotFound(err)
	}
	response, err := s.repo.LoadResponse(currentUser.BusinessID, *account)
	if err != nil {
		return nil, apperrors.Internal("failed to load chart account details")
	}
	return &response, nil
}

func (s *Service) GetLedgerDetails(currentUser *utils.AuthContext, id string, query LedgerDetailsQuery, ipAddress, userAgent string) (*LedgerDetailsResponse, error) {
	account, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapChartAccountNotFound(err)
	}
	accountResponse, err := s.repo.LoadResponse(currentUser.BusinessID, *account)
	if err != nil {
		return nil, apperrors.Internal("failed to load chart account details")
	}
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder == "" {
		query.SortOrder = "asc"
	}
	dateFrom, dateTo := defaultLedgerDetailsDateRange(query.DateFrom, query.DateTo)
	query.DateFrom = dateFrom
	query.DateTo = dateTo
	if query.SortOrder != "asc" && query.SortOrder != "desc" {
		return nil, apperrors.BadRequest("sort_order must be asc or desc", nil)
	}
	ledgerQuery := GeneralLedgerQuery{
		AccountID: id,
		BranchID:  query.BranchID,
		DateFrom:  query.DateFrom,
		DateTo:    query.DateTo,
		Page:      query.Page,
		Limit:     query.Limit,
		SortOrder: query.SortOrder,
	}
	if err := s.validateAccountingReportFilters(currentUser, ledgerQuery.AccountID, ledgerQuery.BranchID, ledgerQuery.DateFrom, ledgerQuery.DateTo); err != nil {
		return nil, err
	}
	openingBalance, err := s.repo.GeneralLedgerOpeningBalance(currentUser.BusinessID, ledgerQuery)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate ledger opening balance")
	}
	periodDebit, periodCredit, err := s.repo.GeneralLedgerPeriodTotals(currentUser.BusinessID, ledgerQuery)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate ledger period totals")
	}
	total, err := s.repo.CountGeneralLedgerRows(currentUser.BusinessID, ledgerQuery)
	if err != nil {
		return nil, apperrors.Internal("failed to count ledger transactions")
	}
	rows, err := s.repo.ListGeneralLedgerRows(currentUser.BusinessID, ledgerQuery, openingBalance)
	if err != nil {
		return nil, apperrors.Internal("failed to load ledger transactions")
	}
	closingRaw := roundMoney(openingBalance + periodDebit - periodCredit)
	_ = s.writeReportAudit(currentUser, "accounting.ledger_details_viewed", "ledger_details", map[string]interface{}{
		"account_id": id,
		"filters":    query,
	}, ipAddress, userAgent)
	return &LedgerDetailsResponse{
		Account: accountResponse,
		Summary: LedgerDetailsSummaryResponse{
			OpeningBalance: roundMoney(absMoney(openingBalance)),
			PeriodDebit:    periodDebit,
			PeriodCredit:   periodCredit,
			ClosingBalance: roundMoney(absMoney(closingRaw)),
			BalanceLabel:   balanceLabel(closingRaw),
		},
		Transactions: rows,
		Pagination:   PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)},
	}, nil
}

func (s *Service) UpdateChartAccount(currentUser *utils.AuthContext, id string, req UpdateChartAccountRequest, ipAddress, userAgent string) (*ChartAccountResponse, error) {
	account, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapChartAccountNotFound(err)
	}
	updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.ParentAccountID != nil {
		parentID := cleanStringPointer(req.ParentAccountID)
		if err := s.validateParentAccount(currentUser.BusinessID, parentID, id); err != nil {
			return nil, err
		}
		updates["parent_account_id"] = parentID
	}
	if req.AccountName != nil {
		name := strings.TrimSpace(*req.AccountName)
		if name == "" {
			return nil, apperrors.BadRequest("account_name cannot be empty", nil)
		}
		updates["account_name"] = name
	}
	if req.AccountGroup != nil {
		group := strings.TrimSpace(*req.AccountGroup)
		if !validAccountGroup(group) {
			return nil, apperrors.BadRequest("invalid account_group", nil)
		}
		updates["account_group"] = group
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.IsControlAccount != nil {
		updates["is_control_account"] = *req.IsControlAccount
	}
	if req.AllowManualPosting != nil {
		updates["allow_manual_posting"] = *req.AllowManualPosting
	}
	if len(updates) == 2 {
		return nil, apperrors.BadRequest("no updatable fields provided", nil)
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.Update(tx, currentUser.BusinessID, account.ID, updates); err != nil {
			return mapChartAccountNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.chart_account_updated", account.ID, "Chart account updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetChartAccount(currentUser, id)
}

func (s *Service) UpdateChartAccountStatus(currentUser *utils.AuthContext, id string, req UpdateChartAccountStatusRequest, ipAddress, userAgent string) (*ChartAccountResponse, error) {
	if !validAccountStatus(req.Status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	account, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapChartAccountNotFound(err)
	}
	if account.IsSystemAccount && req.Status != "active" {
		return nil, apperrors.Forbidden("system chart accounts cannot be deactivated")
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{"status": req.Status, "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if err := s.repo.Update(tx, currentUser.BusinessID, account.ID, updates); err != nil {
			return mapChartAccountNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.chart_account_status_updated", account.ID, "Chart account status updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetChartAccount(currentUser, id)
}

func (s *Service) DeleteChartAccount(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	account, err := s.repo.FindByID(currentUser.BusinessID, id)
	if err != nil {
		return mapChartAccountNotFound(err)
	}
	if account.IsSystemAccount {
		return apperrors.Forbidden("system chart accounts cannot be deleted")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		hasChildren, err := s.repo.HasChildren(tx, currentUser.BusinessID, id)
		if err != nil {
			return apperrors.Internal("failed to validate child accounts")
		}
		if hasChildren {
			return apperrors.Conflict("chart account cannot be deleted while child accounts exist", nil)
		}
		updates := map[string]interface{}{"status": "inactive", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC(), "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}}
		if err := s.repo.Update(tx, currentUser.BusinessID, id, updates); err != nil {
			return mapChartAccountNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.chart_account_deleted", id, "Chart account deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListJournalEntries(currentUser *utils.AuthContext, query JournalEntryListQuery) (*PaginatedResponse[JournalEntryResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	if err := validateJournalEntryFilters(query); err != nil {
		return nil, err
	}
	entries, total, err := s.repo.ListJournalEntries(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list journal entries")
	}
	items, err := s.repo.LoadJournalEntryResponses(currentUser.BusinessID, entries, false)
	if err != nil {
		return nil, apperrors.Internal("failed to load journal entry details")
	}
	return &PaginatedResponse[JournalEntryResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) GetGeneralLedger(currentUser *utils.AuthContext, query GeneralLedgerQuery, ipAddress, userAgent string) (*GeneralLedgerResponse, error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.AccountID = strings.TrimSpace(query.AccountID)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder == "" {
		query.SortOrder = "asc"
	}
	if err := s.validateAccountingReportFilters(currentUser, query.AccountID, query.BranchID, query.DateFrom, query.DateTo); err != nil {
		return nil, err
	}
	if query.SortOrder != "asc" && query.SortOrder != "desc" {
		return nil, apperrors.BadRequest("sort_order must be asc or desc", nil)
	}
	var account *GeneralLedgerAccountResponse
	if query.AccountID != "" {
		found, err := s.repo.FindAccountForReport(currentUser.BusinessID, query.AccountID)
		if err != nil {
			return nil, mapChartAccountNotFound(err)
		}
		account = found
	}
	openingBalance, err := s.repo.GeneralLedgerOpeningBalance(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate ledger opening balance")
	}
	periodDebit, periodCredit, err := s.repo.GeneralLedgerPeriodTotals(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate ledger period totals")
	}
	total, err := s.repo.CountGeneralLedgerRows(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to count general ledger rows")
	}
	rows, err := s.repo.ListGeneralLedgerRows(currentUser.BusinessID, query, openingBalance)
	if err != nil {
		return nil, apperrors.Internal("failed to load general ledger")
	}
	_ = s.writeReportAudit(currentUser, "accounting.general_ledger_viewed", "general_ledger", query, ipAddress, userAgent)
	return &GeneralLedgerResponse{
		Account:        account,
		OpeningBalance: openingBalance,
		PeriodDebit:    periodDebit,
		PeriodCredit:   periodCredit,
		ClosingBalance: roundMoney(openingBalance + periodDebit - periodCredit),
		Items:          rows,
		Pagination:     PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)},
	}, nil
}

func (s *Service) GetTrialBalance(currentUser *utils.AuthContext, query TrialBalanceQuery, ipAddress, userAgent string) (*TrialBalanceResponse, error) {
	query.BranchID = strings.TrimSpace(query.BranchID)
	if err := s.validateAccountingReportFilters(currentUser, "", query.BranchID, query.DateFrom, query.DateTo); err != nil {
		return nil, err
	}
	rows, err := s.repo.ListTrialBalanceRows(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to load trial balance")
	}
	totalDebit, totalCredit := 0.0, 0.0
	for _, row := range rows {
		totalDebit += row.ClosingDebit
		totalCredit += row.ClosingCredit
	}
	totalDebit = roundMoney(totalDebit)
	totalCredit = roundMoney(totalCredit)
	_ = s.writeReportAudit(currentUser, "accounting.trial_balance_viewed", "trial_balance", query, ipAddress, userAgent)
	return &TrialBalanceResponse{
		DateFrom:    query.DateFrom,
		DateTo:      query.DateTo,
		TotalDebit:  totalDebit,
		TotalCredit: totalCredit,
		IsBalanced:  roundMoney(totalDebit-totalCredit) == 0,
		Items:       rows,
	}, nil
}

func (s *Service) GetProfitLoss(currentUser *utils.AuthContext, query ProfitLossQuery, ipAddress, userAgent string) (*ProfitLossResponse, error) {
	query.BranchID = strings.TrimSpace(query.BranchID)
	if err := s.validateAccountingReportFilters(currentUser, "", query.BranchID, query.DateFrom, query.DateTo); err != nil {
		return nil, err
	}
	rows, err := s.repo.ListProfitLossRows(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to load profit and loss report")
	}
	income := ProfitLossSectionResponse{Items: []ProfitLossAccountRowResponse{}}
	cogs := ProfitLossSectionResponse{Items: []ProfitLossAccountRowResponse{}}
	operatingExpenses := ProfitLossSectionResponse{Items: []ProfitLossAccountRowResponse{}}
	for _, row := range rows {
		switch row.AccountType {
		case "income":
			income.Items = append(income.Items, row)
			income.Total = roundMoney(income.Total + row.Amount)
		case "cogs":
			cogs.Items = append(cogs.Items, row)
			cogs.Total = roundMoney(cogs.Total + row.Amount)
		case "expense":
			operatingExpenses.Items = append(operatingExpenses.Items, row)
			operatingExpenses.Total = roundMoney(operatingExpenses.Total + row.Amount)
		}
	}
	grossProfit := roundMoney(income.Total - cogs.Total)
	totalExpenses := roundMoney(cogs.Total + operatingExpenses.Total)
	netProfit := roundMoney(grossProfit - operatingExpenses.Total)
	_ = s.writeReportAudit(currentUser, "accounting.profit_loss_viewed", "profit_loss", query, ipAddress, userAgent)
	return &ProfitLossResponse{
		DateFrom:          query.DateFrom,
		DateTo:            query.DateTo,
		Income:            income,
		COGS:              cogs,
		GrossProfit:       grossProfit,
		OperatingExpenses: operatingExpenses,
		TotalExpenses:     totalExpenses,
		NetProfit:         netProfit,
	}, nil
}

func (s *Service) GetBalanceSheet(currentUser *utils.AuthContext, query BalanceSheetQuery, ipAddress, userAgent string) (*BalanceSheetResponse, error) {
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.AsOfDate = strings.TrimSpace(query.AsOfDate)
	if err := s.validateBalanceSheetFilters(currentUser, query); err != nil {
		return nil, err
	}
	rows, err := s.repo.ListBalanceSheetRows(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to load balance sheet")
	}
	assets := BalanceSheetSectionResponse{Items: []BalanceSheetAccountRowResponse{}}
	liabilities := BalanceSheetSectionResponse{Items: []BalanceSheetAccountRowResponse{}}
	equity := BalanceSheetSectionResponse{Items: []BalanceSheetAccountRowResponse{}}
	for _, row := range rows {
		switch row.AccountType {
		case "asset":
			assets.Items = append(assets.Items, row)
			assets.Total = roundMoney(assets.Total + row.Amount)
		case "liability":
			liabilities.Items = append(liabilities.Items, row)
			liabilities.Total = roundMoney(liabilities.Total + row.Amount)
		case "equity":
			equity.Items = append(equity.Items, row)
			equity.Total = roundMoney(equity.Total + row.Amount)
		}
	}
	totalLiabilitiesAndEquity := roundMoney(liabilities.Total + equity.Total)
	difference := roundMoney(assets.Total - totalLiabilitiesAndEquity)
	_ = s.writeReportAudit(currentUser, "accounting.balance_sheet_viewed", "balance_sheet", query, ipAddress, userAgent)
	return &BalanceSheetResponse{
		AsOfDate:                  query.AsOfDate,
		Assets:                    assets,
		Liabilities:               liabilities,
		Equity:                    equity,
		TotalAssets:               assets.Total,
		TotalLiabilities:          liabilities.Total,
		TotalEquity:               equity.Total,
		TotalLiabilitiesAndEquity: totalLiabilitiesAndEquity,
		IsBalanced:                difference == 0,
		Difference:                difference,
	}, nil
}

func (s *Service) CreateJournalEntry(currentUser *utils.AuthContext, req CreateJournalEntryRequest, ipAddress, userAgent string) (*JournalEntryResponse, error) {
	entryDate, err := parseRequiredDate(req.EntryDate, "entry_date")
	if err != nil {
		return nil, err
	}
	branchID := cleanStringPointer(req.BranchID)
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.validateJournalBranch(tx, currentUser, branchID); err != nil {
			return err
		}
		lines, totalDebit, totalCredit, err := s.buildJournalLines(tx, currentUser.BusinessID, "", req.Lines)
		if err != nil {
			return err
		}
		entryNumber, err := s.repo.NextJournalEntryNumber(tx, currentUser.BusinessID, entryDate)
		if err != nil {
			return apperrors.Internal("failed to generate journal entry number")
		}
		entryID := utils.NewUUID()
		for i := range lines {
			lines[i].JournalEntryID = entryID
		}
		entry := &JournalEntry{
			ID:              entryID,
			BusinessID:      currentUser.BusinessID,
			BranchID:        branchID,
			EntryNumber:     entryNumber,
			EntryDate:       entryDate,
			ReferenceNumber: strings.TrimSpace(req.ReferenceNumber),
			SourceType:      strings.TrimSpace(req.SourceType),
			SourceID:        cleanStringPointer(req.SourceID),
			Narration:       strings.TrimSpace(req.Narration),
			Status:          "draft",
			TotalDebit:      totalDebit,
			TotalCredit:     totalCredit,
			CreatedByUserID: currentUser.UserID,
			UpdatedByUserID: &currentUser.UserID,
		}
		if err := s.repo.CreateJournalEntry(tx, entry, lines); err != nil {
			return apperrors.Internal("failed to create journal entry")
		}
		createdID = entry.ID
		return s.writeAudit(tx, currentUser, "accounting.journal_entry_created", entry.ID, "Journal entry created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetJournalEntry(currentUser, createdID)
}

func (s *Service) GetJournalEntry(currentUser *utils.AuthContext, id string) (*JournalEntryResponse, error) {
	entry, err := s.repo.FindJournalEntryByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapJournalEntryNotFound(err)
	}
	response, err := s.repo.LoadJournalEntryResponse(currentUser.BusinessID, *entry, true)
	if err != nil {
		return nil, apperrors.Internal("failed to load journal entry details")
	}
	return &response, nil
}

func (s *Service) UpdateJournalEntry(currentUser *utils.AuthContext, id string, req UpdateJournalEntryRequest, ipAddress, userAgent string) (*JournalEntryResponse, error) {
	if err := s.withTransaction(func(tx *gorm.DB) error {
		entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapJournalEntryNotFound(err)
		}
		if entry.Status != "draft" {
			return apperrors.BadRequest("only draft journal entries can be updated", nil)
		}
		updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if req.BranchID != nil {
			branchID := cleanStringPointer(req.BranchID)
			if err := s.validateJournalBranch(tx, currentUser, branchID); err != nil {
				return err
			}
			updates["branch_id"] = branchID
		}
		if req.EntryDate != nil {
			entryDate, err := parseRequiredDate(*req.EntryDate, "entry_date")
			if err != nil {
				return err
			}
			updates["entry_date"] = entryDate
		}
		if req.ReferenceNumber != nil {
			updates["reference_number"] = strings.TrimSpace(*req.ReferenceNumber)
		}
		if req.SourceType != nil {
			updates["source_type"] = strings.TrimSpace(*req.SourceType)
		}
		if req.SourceID != nil {
			updates["source_id"] = cleanStringPointer(req.SourceID)
		}
		if req.Narration != nil {
			updates["narration"] = strings.TrimSpace(*req.Narration)
		}
		if len(req.Lines) > 0 {
			lines, totalDebit, totalCredit, err := s.buildJournalLines(tx, currentUser.BusinessID, entry.ID, req.Lines)
			if err != nil {
				return err
			}
			updates["total_debit"] = totalDebit
			updates["total_credit"] = totalCredit
			if err := s.repo.ReplaceJournalEntryLines(tx, currentUser.BusinessID, entry.ID, lines); err != nil {
				return apperrors.Internal("failed to update journal entry lines")
			}
		}
		if len(updates) == 2 {
			return apperrors.BadRequest("no updatable fields provided", nil)
		}
		if err := s.repo.UpdateJournalEntry(tx, currentUser.BusinessID, entry.ID, updates); err != nil {
			return mapJournalEntryNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.journal_entry_updated", entry.ID, "Journal entry updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetJournalEntry(currentUser, id)
}

func (s *Service) PostJournalEntry(currentUser *utils.AuthContext, id, ipAddress, userAgent string) (*JournalEntryResponse, error) {
	if err := s.withTransaction(func(tx *gorm.DB) error {
		entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapJournalEntryNotFound(err)
		}
		if entry.Status != "draft" {
			return apperrors.BadRequest("only draft journal entries can be posted", nil)
		}
		lines, err := s.repo.ListJournalEntryLines(currentUser.BusinessID, entry.ID)
		if err != nil {
			return apperrors.Internal("failed to validate journal entry lines")
		}
		if len(lines) < 2 {
			return apperrors.BadRequest("journal entry must have at least two lines", nil)
		}
		now := time.Now().UTC()
		updates := map[string]interface{}{"status": "posted", "posted_at": now, "posted_by_user_id": currentUser.UserID, "updated_by_user_id": currentUser.UserID, "updated_at": now}
		if err := s.repo.UpdateJournalEntry(tx, currentUser.BusinessID, entry.ID, updates); err != nil {
			return mapJournalEntryNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.journal_entry_posted", entry.ID, "Journal entry posted.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetJournalEntry(currentUser, id)
}

func (s *Service) ReverseJournalEntry(currentUser *utils.AuthContext, id string, req ReverseJournalEntryRequest, ipAddress, userAgent string) (*JournalEntryResponse, error) {
	reversalDate := time.Now().UTC()
	if strings.TrimSpace(req.EntryDate) != "" {
		parsed, err := parseRequiredDate(req.EntryDate, "entry_date")
		if err != nil {
			return nil, err
		}
		reversalDate = parsed
	}
	var reversalID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapJournalEntryNotFound(err)
		}
		if entry.Status != "posted" {
			return apperrors.BadRequest("only posted journal entries can be reversed", nil)
		}
		lines, err := s.repo.ListJournalEntryLines(currentUser.BusinessID, entry.ID)
		if err != nil {
			return apperrors.Internal("failed to load journal entry lines")
		}
		reversalEntryNumber, err := s.repo.NextJournalEntryNumber(tx, currentUser.BusinessID, reversalDate)
		if err != nil {
			return apperrors.Internal("failed to generate reversal journal entry number")
		}
		reversalID = utils.NewUUID()
		reversalLines := make([]JournalEntryLine, 0, len(lines))
		for i, line := range lines {
			reversalLines = append(reversalLines, JournalEntryLine{
				ID:             utils.NewUUID(),
				BusinessID:     currentUser.BusinessID,
				JournalEntryID: reversalID,
				AccountID:      line.AccountID,
				LineNumber:     i + 1,
				DebitAmount:    roundMoney(line.CreditAmount),
				CreditAmount:   roundMoney(line.DebitAmount),
				Description:    "Reversal: " + line.Description,
			})
		}
		narration := strings.TrimSpace(req.Narration)
		if narration == "" {
			narration = "Reversal of " + entry.EntryNumber
		}
		referenceNumber := strings.TrimSpace(req.ReferenceNumber)
		if referenceNumber == "" {
			referenceNumber = entry.EntryNumber
		}
		now := time.Now().UTC()
		reversal := &JournalEntry{
			ID:              reversalID,
			BusinessID:      currentUser.BusinessID,
			BranchID:        entry.BranchID,
			EntryNumber:     reversalEntryNumber,
			EntryDate:       reversalDate,
			ReferenceNumber: referenceNumber,
			SourceType:      "journal_reversal",
			SourceID:        &entry.ID,
			Narration:       narration,
			Status:          "posted",
			TotalDebit:      roundMoney(entry.TotalCredit),
			TotalCredit:     roundMoney(entry.TotalDebit),
			PostedAt:        &now,
			PostedByUserID:  &currentUser.UserID,
			ReversedEntryID: &entry.ID,
			CreatedByUserID: currentUser.UserID,
			UpdatedByUserID: &currentUser.UserID,
		}
		if err := s.repo.CreateJournalEntry(tx, reversal, reversalLines); err != nil {
			return apperrors.Internal("failed to create reversal journal entry")
		}
		if err := s.repo.UpdateJournalEntry(tx, currentUser.BusinessID, entry.ID, map[string]interface{}{"status": "reversed", "reversed_at": now, "reversed_by_user_id": currentUser.UserID, "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
			return mapJournalEntryNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.journal_entry_reversed", entry.ID, "Journal entry reversed.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetJournalEntry(currentUser, reversalID)
}

func (s *Service) validateJournalBranch(tx *gorm.DB, currentUser *utils.AuthContext, branchID *string) error {
	if branchID == nil || *branchID == "" {
		return nil
	}
	if !currentUser.CanAccessBranch(*branchID) {
		return apperrors.Forbidden("branch access denied")
	}
	ok, err := s.repo.BranchExists(tx, currentUser.BusinessID, *branchID)
	if err != nil {
		return apperrors.Internal("failed to validate branch")
	}
	if !ok {
		return apperrors.BadRequest("invalid branch_id", nil)
	}
	return nil
}

func (s *Service) buildJournalLines(tx *gorm.DB, businessID, entryID string, lineRequests []JournalEntryLineRequest) ([]JournalEntryLine, float64, float64, error) {
	if len(lineRequests) < 2 {
		return nil, 0, 0, apperrors.BadRequest("journal entry must have at least two lines", nil)
	}
	lines := make([]JournalEntryLine, 0, len(lineRequests))
	totalDebit, totalCredit := 0.0, 0.0
	for i, lineReq := range lineRequests {
		debit := roundMoney(lineReq.DebitAmount)
		credit := roundMoney(lineReq.CreditAmount)
		if debit < 0 || credit < 0 {
			return nil, 0, 0, apperrors.BadRequest("line debit_amount and credit_amount must be >= 0", nil)
		}
		if debit > 0 && credit > 0 {
			return nil, 0, 0, apperrors.BadRequest("a journal line cannot have both debit and credit", nil)
		}
		if debit == 0 && credit == 0 {
			return nil, 0, 0, apperrors.BadRequest("each journal line must have debit or credit amount", nil)
		}
		account, err := s.repo.ValidateActiveAccount(tx, businessID, strings.TrimSpace(lineReq.AccountID))
		if err != nil {
			return nil, 0, 0, apperrors.BadRequest("invalid account_id", map[string]interface{}{"line_number": i + 1})
		}
		if !account.AllowManualPosting {
			return nil, 0, 0, apperrors.BadRequest("manual posting is not allowed for this account", map[string]interface{}{"line_number": i + 1, "account_id": account.ID})
		}
		lines = append(lines, JournalEntryLine{
			ID:             utils.NewUUID(),
			BusinessID:     businessID,
			JournalEntryID: entryID,
			AccountID:      account.ID,
			LineNumber:     i + 1,
			DebitAmount:    debit,
			CreditAmount:   credit,
			Description:    strings.TrimSpace(lineReq.Description),
		})
		totalDebit += debit
		totalCredit += credit
	}
	totalDebit = roundMoney(totalDebit)
	totalCredit = roundMoney(totalCredit)
	if totalDebit != totalCredit {
		return nil, 0, 0, apperrors.BadRequest("total debit must equal total credit", map[string]interface{}{"total_debit": totalDebit, "total_credit": totalCredit})
	}
	return lines, totalDebit, totalCredit, nil
}

func (s *Service) validateParentAccount(businessID string, parentID *string, selfID string) error {
	if parentID == nil || *parentID == "" {
		return nil
	}
	if *parentID == selfID {
		return apperrors.BadRequest("parent_account_id cannot reference the same account", nil)
	}
	nextParentID := *parentID
	for depth := 0; depth < 50; depth++ {
		parent, err := s.repo.FindByID(businessID, nextParentID)
		if err != nil {
			return apperrors.BadRequest("invalid parent_account_id", nil)
		}
		if parent.Status != "active" {
			return apperrors.BadRequest("parent account must be active", nil)
		}
		if parent.ParentAccountID == nil || *parent.ParentAccountID == "" {
			return nil
		}
		if *parent.ParentAccountID == selfID {
			return apperrors.BadRequest("parent_account_id cannot create an account hierarchy cycle", nil)
		}
		nextParentID = *parent.ParentAccountID
	}
	return apperrors.BadRequest("account hierarchy is too deep", nil)
}

func validateCreateChartAccountRequest(req CreateChartAccountRequest) error {
	if strings.TrimSpace(req.AccountCode) == "" {
		return apperrors.BadRequest("account_code is required", nil)
	}
	if strings.TrimSpace(req.AccountName) == "" {
		return apperrors.BadRequest("account_name is required", nil)
	}
	if !validAccountType(strings.TrimSpace(req.AccountType)) {
		return apperrors.BadRequest("invalid account_type", nil)
	}
	if !validAccountGroup(strings.TrimSpace(req.AccountGroup)) {
		return apperrors.BadRequest("invalid account_group", nil)
	}
	if !validNormalBalance(strings.TrimSpace(req.NormalBalance)) {
		return apperrors.BadRequest("normal_balance must be debit or credit", nil)
	}
	return nil
}

func validateChartAccountFilters(query ChartAccountListQuery) error {
	if query.AccountType != "" && !validAccountType(query.AccountType) {
		return apperrors.BadRequest("invalid account_type", nil)
	}
	if query.AccountGroup != "" && !validAccountGroup(query.AccountGroup) {
		return apperrors.BadRequest("invalid account_group", nil)
	}
	if query.Status != "" && !validAccountStatus(query.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	return nil
}

func validateJournalEntryFilters(query JournalEntryListQuery) error {
	if query.Status != "" && !validJournalEntryStatus(query.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	if query.DateFrom != "" {
		if _, err := time.Parse("2006-01-02", query.DateFrom); err != nil {
			return apperrors.BadRequest("date_from must be YYYY-MM-DD", nil)
		}
	}
	if query.DateTo != "" {
		if _, err := time.Parse("2006-01-02", query.DateTo); err != nil {
			return apperrors.BadRequest("date_to must be YYYY-MM-DD", nil)
		}
	}
	if query.DateFrom != "" && query.DateTo != "" {
		from, _ := time.Parse("2006-01-02", query.DateFrom)
		to, _ := time.Parse("2006-01-02", query.DateTo)
		if from.After(to) {
			return apperrors.BadRequest("date_from cannot be after date_to", nil)
		}
	}
	return nil
}

func (s *Service) validateAccountingReportFilters(currentUser *utils.AuthContext, accountID, branchID, dateFrom, dateTo string) error {
	if strings.TrimSpace(accountID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(accountID)); err != nil {
			return apperrors.BadRequest("account_id must be a valid UUID", nil)
		}
	}
	if strings.TrimSpace(branchID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(branchID)); err != nil {
			return apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := s.validateJournalBranch(s.db, currentUser, &branchID); err != nil {
			return err
		}
	}
	if strings.TrimSpace(dateFrom) == "" {
		return apperrors.BadRequest("date_from is required", nil)
	}
	if strings.TrimSpace(dateTo) == "" {
		return apperrors.BadRequest("date_to is required", nil)
	}
	from, err := time.Parse("2006-01-02", strings.TrimSpace(dateFrom))
	if err != nil {
		return apperrors.BadRequest("date_from must be YYYY-MM-DD", nil)
	}
	to, err := time.Parse("2006-01-02", strings.TrimSpace(dateTo))
	if err != nil {
		return apperrors.BadRequest("date_to must be YYYY-MM-DD", nil)
	}
	if from.After(to) {
		return apperrors.BadRequest("date_from cannot be after date_to", nil)
	}
	return nil
}

func (s *Service) validateBalanceSheetFilters(currentUser *utils.AuthContext, query BalanceSheetQuery) error {
	if strings.TrimSpace(query.BranchID) != "" {
		if _, err := uuid.Parse(strings.TrimSpace(query.BranchID)); err != nil {
			return apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := s.validateJournalBranch(s.db, currentUser, &query.BranchID); err != nil {
			return err
		}
	}
	if strings.TrimSpace(query.AsOfDate) == "" {
		return apperrors.BadRequest("as_of_date is required", nil)
	}
	if _, err := time.Parse("2006-01-02", strings.TrimSpace(query.AsOfDate)); err != nil {
		return apperrors.BadRequest("as_of_date must be YYYY-MM-DD", nil)
	}
	return nil
}

func validAccountType(value string) bool {
	switch value {
	case "asset", "liability", "equity", "income", "cogs", "expense":
		return true
	default:
		return false
	}
}

func validAccountGroup(value string) bool {
	switch value {
	case "current_asset",
		"other_current_asset",
		"fixed_asset",
		"non_current_asset",
		"accumulated_depreciation",
		"contra_asset",
		"current_liability",
		"other_current_liability",
		"long_term_liability",
		"other_liability",
		"equity",
		"partner_capital",
		"sales_income",
		"service_income",
		"discount_income",
		"other_income",
		"direct_expense",
		"operating_expense",
		"admin_expense",
		"selling_expense",
		"finance_cost",
		"tax_expense":
		return true
	default:
		return false
	}
}

func validNormalBalance(value string) bool {
	return value == "debit" || value == "credit"
}

func validAccountStatus(value string) bool {
	return value == "active" || value == "inactive"
}

func validJournalEntryStatus(value string) bool {
	return value == "draft" || value == "posted" || value == "reversed"
}

func parseRequiredDate(value, field string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, apperrors.BadRequest(field+" must be YYYY-MM-DD", nil)
	}
	return parsed, nil
}

func defaultLedgerDetailsDateRange(dateFrom, dateTo string) (string, string) {
	dateFrom = strings.TrimSpace(dateFrom)
	dateTo = strings.TrimSpace(dateTo)
	now := time.Now().UTC()
	if dateTo == "" {
		dateTo = now.Format("2006-01-02")
	}
	if dateFrom == "" {
		if parsedTo, err := time.Parse("2006-01-02", dateTo); err == nil {
			dateFrom = time.Date(parsedTo.Year(), 1, 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
		} else {
			dateFrom = now.AddDate(-1, 0, 0).Format("2006-01-02")
		}
	}
	return dateFrom, dateTo
}

func balanceLabel(value float64) string {
	if value < 0 {
		return "Cr"
	}
	return "Dr"
}

func absMoney(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}

func cleanStringPointer(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func mapChartAccountNotFound(err error) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound("chart account not found")
	}
	return apperrors.Internal("failed to load chart account")
}

func mapJournalEntryNotFound(err error) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound("journal entry not found")
	}
	return apperrors.Internal("failed to load journal entry")
}

func (s *Service) withTransaction(fn func(tx *gorm.DB) error) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return apperrors.Internal("failed to start transaction")
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return apperrors.Internal("failed to commit transaction")
	}
	return nil
}

func (s *Service) writeAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "chart_account", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func (s *Service) writeReportAudit(currentUser *utils.AuthContext, eventType, reportName string, filters interface{}, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  "accounting_report",
		EntityID:    reportName,
		Summary:     "Accounting report viewed.",
		Metadata: map[string]interface{}{
			"report_name": reportName,
			"filters":     filters,
		},
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}
