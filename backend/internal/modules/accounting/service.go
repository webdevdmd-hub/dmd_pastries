package accounting

import (
	"sort"
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
		if err := SeedDefaultAccountMappings(tx, currentUser.BusinessID); err != nil {
			return apperrors.Internal("failed to seed chart of accounts")
		}
		return s.writeAudit(tx, currentUser, "accounting.chart_accounts_seeded", currentUser.BusinessID, "Chart of accounts defaults seeded.", ipAddress, userAgent)
	})
}

func (s *Service) ListAccountMappings(currentUser *utils.AuthContext) ([]AccountMappingResponse, error) {
	rows, err := s.repo.ListAccountMappings(currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to list account mappings")
	}
	return rows, nil
}

func (s *Service) SeedAccountMappings(currentUser *utils.AuthContext, ipAddress, userAgent string) ([]AccountMappingResponse, error) {
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := SeedDefaultAccountMappings(tx, currentUser.BusinessID); err != nil {
			return apperrors.Internal("failed to seed account mappings")
		}
		return s.writeAudit(tx, currentUser, "accounting.account_mappings_seeded", currentUser.BusinessID, "Account mappings defaults seeded.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.ListAccountMappings(currentUser)
}

func (s *Service) UpdateAccountMappings(currentUser *utils.AuthContext, req UpdateAccountMappingsRequest, ipAddress, userAgent string) ([]AccountMappingResponse, error) {
	if len(req.Mappings) == 0 {
		return nil, apperrors.BadRequest("mappings is required", nil)
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		for key, accountID := range req.Mappings {
			key = strings.TrimSpace(key)
			if !validAccountMappingKey(key) {
				return apperrors.BadRequest("invalid account mapping key", map[string]string{"mapping_key": key})
			}
			account, err := s.repo.ValidateActiveAccount(tx, currentUser.BusinessID, strings.TrimSpace(accountID))
			if err != nil {
				return apperrors.BadRequest("invalid chart account for mapping", map[string]string{"mapping_key": key})
			}
			mapping := &AccountMapping{
				ID:             utils.NewUUID(),
				BusinessID:     currentUser.BusinessID,
				MappingKey:     key,
				ChartAccountID: account.ID,
				Description:    defaultAccountMappingDescription(key),
			}
			if err := s.repo.UpsertAccountMapping(tx, mapping); err != nil {
				return apperrors.Internal("failed to update account mapping")
			}
		}
		return s.writeAudit(tx, currentUser, "accounting.account_mappings_updated", currentUser.BusinessID, "Account mappings updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.ListAccountMappings(currentUser)
}

func (s *Service) GetAccountingSettings(currentUser *utils.AuthContext) (*AccountingSettingsResponse, error) {
	row, err := s.repo.EnsureAccountingSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load accounting settings")
	}
	response := toAccountingSettingsResponse(row)
	return &response, nil
}

func (s *Service) UpdateAccountingSettings(currentUser *utils.AuthContext, req UpdateAccountingSettingsRequest, ipAddress, userAgent string) (*AccountingSettingsResponse, error) {
	current, err := s.repo.EnsureAccountingSettings(s.db, currentUser.BusinessID)
	if err != nil {
		return nil, apperrors.Internal("failed to load accounting settings")
	}
	month := current.FinancialYearStartMonth
	day := current.FinancialYearStartDay
	if req.FinancialYearStartMonth != nil {
		month = *req.FinancialYearStartMonth
	}
	if req.FinancialYearStartDay != nil {
		day = *req.FinancialYearStartDay
	}
	if err := validateFinancialYearStart(month, day); err != nil {
		return nil, err
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := s.repo.UpdateAccountingSettings(tx, currentUser.BusinessID, map[string]interface{}{
			"financial_year_start_month": month,
			"financial_year_start_day":   day,
			"updated_at":                 time.Now().UTC(),
		}); err != nil {
			return apperrors.Internal("failed to update accounting settings")
		}
		return s.writeAudit(tx, currentUser, "accounting.settings.updated", currentUser.BusinessID, "Accounting settings updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetAccountingSettings(currentUser)
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

func (s *Service) ListPaymentAccounts(currentUser *utils.AuthContext, query PaymentAccountListQuery) (*PaginatedResponse[PaymentAccountResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.AccountType = strings.TrimSpace(query.AccountType)
	query.Status = strings.TrimSpace(query.Status)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder == "" {
		query.SortOrder = "asc"
	}
	if err := s.validatePaymentAccountFilters(currentUser, query); err != nil {
		return nil, err
	}
	accounts, total, err := s.repo.ListPaymentAccounts(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list payment accounts")
	}
	items, err := s.repo.LoadPaymentAccountResponses(currentUser.BusinessID, accounts)
	if err != nil {
		return nil, apperrors.Internal("failed to load payment account details")
	}
	return &PaginatedResponse[PaymentAccountResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreatePaymentAccount(currentUser *utils.AuthContext, req CreatePaymentAccountRequest, ipAddress, userAgent string) (*PaymentAccountResponse, error) {
	name := strings.TrimSpace(req.AccountName)
	accountType := strings.TrimSpace(req.AccountType)
	if name == "" {
		return nil, apperrors.BadRequest("account_name is required", nil)
	}
	if !validPaymentAccountType(accountType) {
		return nil, apperrors.BadRequest("invalid account_type", nil)
	}
	chartAccountID := strings.TrimSpace(req.ChartAccountID)
	if _, err := uuid.Parse(chartAccountID); err != nil {
		return nil, apperrors.BadRequest("chart_account_id must be a valid UUID", nil)
	}
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "active"
	}
	if !validAccountStatus(status) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	branchID := cleanStringPointer(req.BranchID)
	if err := s.validateJournalBranch(s.db, currentUser, branchID); err != nil {
		return nil, err
	}
	if exists, err := s.repo.PaymentAccountNameExists(currentUser.BusinessID, branchID, name, ""); err != nil {
		return nil, apperrors.Internal("failed to validate payment account name")
	} else if exists {
		return nil, apperrors.Conflict("payment account name already exists for this branch scope", nil)
	}
	if exists, err := s.repo.PaymentAccountChartExists(currentUser.BusinessID, branchID, chartAccountID, ""); err != nil {
		return nil, apperrors.Internal("failed to validate chart account mapping")
	} else if exists {
		return nil, apperrors.Conflict("chart account is already linked to a payment account for this branch scope", nil)
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if _, err := s.repo.ValidateActiveAssetChartAccount(tx, currentUser.BusinessID, chartAccountID); err != nil {
			if err == gorm.ErrRecordNotFound {
				return apperrors.BadRequest("chart_account_id must reference an active asset account", nil)
			}
			return apperrors.Internal("failed to validate chart account")
		}
		account := &PaymentAccount{
			ID:              utils.NewUUID(),
			BusinessID:      currentUser.BusinessID,
			BranchID:        branchID,
			AccountName:     name,
			AccountType:     accountType,
			ChartAccountID:  chartAccountID,
			Description:     strings.TrimSpace(req.Description),
			Status:          status,
			CreatedByUserID: &currentUser.UserID,
			UpdatedByUserID: &currentUser.UserID,
		}
		if err := s.repo.CreatePaymentAccount(tx, account); err != nil {
			return apperrors.Internal("failed to create payment account")
		}
		createdID = account.ID
		return s.writeEntityAudit(tx, currentUser, "payment_account.created", "payment_account", account.ID, "Payment account created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetPaymentAccount(currentUser, createdID)
}

func (s *Service) SeedDefaultPaymentAccounts(currentUser *utils.AuthContext, ipAddress, userAgent string) (*SeedPaymentAccountsResponse, error) {
	var result SeedPaymentAccountsResponse
	type seed struct {
		MethodName        string
		MethodType        string
		AccountNamePrefix string
		AccountType       string
		ChartCode         string
		IsDefault         bool
		RequiresReference bool
	}
	seeds := []seed{
		{MethodName: "Cash", MethodType: "cash", AccountNamePrefix: "Cash Box", AccountType: "cash", ChartCode: "1000", IsDefault: true, RequiresReference: false},
		{MethodName: "Card", MethodType: "card", AccountNamePrefix: "Card Clearing", AccountType: "card_clearing", ChartCode: "1030", RequiresReference: true},
		{MethodName: "Bank Transfer", MethodType: "bank_transfer", AccountNamePrefix: "Bank Account", AccountType: "bank", ChartCode: "1010", RequiresReference: true},
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if err := SeedDefaultChartOfAccounts(tx, currentUser.BusinessID); err != nil {
			return apperrors.Internal("failed to seed chart of accounts")
		}
		branches, err := s.repo.ActiveBranches(tx, currentUser.BusinessID)
		if err != nil {
			return apperrors.Internal("failed to load branches")
		}
		if len(branches) == 0 {
			return apperrors.BadRequest("at least one active branch is required to seed payment accounts", nil)
		}
		for _, branch := range branches {
			if !currentUser.CanAccessBranch(branch.ID) {
				continue
			}
			for _, seed := range seeds {
				method, err := s.repo.EnsurePaymentMethod(tx, currentUser.BusinessID, seed.MethodName, seed.MethodType, seed.IsDefault, seed.RequiresReference)
				if err != nil {
					return apperrors.Internal("failed to seed payment methods")
				}
				chart, err := s.repo.FindChartAccountByCode(tx, currentUser.BusinessID, seed.ChartCode)
				if err != nil {
					return apperrors.Internal("failed to load chart account for payment account")
				}
				accountName := strings.TrimSpace(seed.AccountNamePrefix + " - " + branch.BranchName)
				account, created, err := s.repo.FindOrCreatePaymentAccount(tx, currentUser.BusinessID, branch.ID, accountName, seed.AccountType, chart.ID, currentUser.UserID)
				if err != nil {
					return apperrors.Internal("failed to seed payment accounts")
				}
				if created {
					result.CreatedPaymentAccounts++
				}
				linked, err := s.repo.UpsertPaymentMethodAccountMapping(tx, currentUser.BusinessID, branch.ID, method.ID, account.ID)
				if err != nil {
					return apperrors.Internal("failed to link payment method to payment account")
				}
				if linked {
					result.LinkedPaymentMethods++
				}
				if branch.ID == branches[0].ID {
					if err := tx.Table("payment_methods").
						Where("id = ? AND business_id = ?", method.ID, currentUser.BusinessID).
						Update("default_payment_account_id", account.ID).Error; err != nil {
						return apperrors.Internal("failed to update default payment account")
					}
				}
			}
		}
		return s.writeEntityAudit(tx, currentUser, "payment_accounts.seed_defaults", "payment_account", currentUser.BusinessID, "Default payment accounts seeded and linked.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return &result, nil
}

func (s *Service) GetPaymentAccount(currentUser *utils.AuthContext, id string) (*PaymentAccountResponse, error) {
	account, err := s.repo.FindPaymentAccountByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapPaymentAccountNotFound(err)
	}
	if account.BranchID != nil && *account.BranchID != "" && !currentUser.CanAccessBranch(*account.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	response, err := s.repo.LoadPaymentAccountResponse(currentUser.BusinessID, *account)
	if err != nil {
		return nil, apperrors.Internal("failed to load payment account details")
	}
	return &response, nil
}

func (s *Service) UpdatePaymentAccount(currentUser *utils.AuthContext, id string, req UpdatePaymentAccountRequest, ipAddress, userAgent string) (*PaymentAccountResponse, error) {
	account, err := s.repo.FindPaymentAccountByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapPaymentAccountNotFound(err)
	}
	if account.BranchID != nil && *account.BranchID != "" && !currentUser.CanAccessBranch(*account.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	targetBranchID := account.BranchID
	if req.BranchID != nil {
		targetBranchID = cleanStringPointer(req.BranchID)
		if err := s.validateJournalBranch(s.db, currentUser, targetBranchID); err != nil {
			return nil, err
		}
	}
	targetName := account.AccountName
	if req.AccountName != nil {
		targetName = strings.TrimSpace(*req.AccountName)
		if targetName == "" {
			return nil, apperrors.BadRequest("account_name cannot be empty", nil)
		}
	}
	targetChartAccountID := account.ChartAccountID
	if req.ChartAccountID != nil {
		targetChartAccountID = strings.TrimSpace(*req.ChartAccountID)
		if _, err := uuid.Parse(targetChartAccountID); err != nil {
			return nil, apperrors.BadRequest("chart_account_id must be a valid UUID", nil)
		}
	}
	if exists, err := s.repo.PaymentAccountNameExists(currentUser.BusinessID, targetBranchID, targetName, id); err != nil {
		return nil, apperrors.Internal("failed to validate payment account name")
	} else if exists {
		return nil, apperrors.Conflict("payment account name already exists for this branch scope", nil)
	}
	if exists, err := s.repo.PaymentAccountChartExists(currentUser.BusinessID, targetBranchID, targetChartAccountID, id); err != nil {
		return nil, apperrors.Internal("failed to validate chart account mapping")
	} else if exists {
		return nil, apperrors.Conflict("chart account is already linked to a payment account for this branch scope", nil)
	}
	updates := map[string]interface{}{"updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
	if req.BranchID != nil {
		if targetBranchID == nil {
			updates["branch_id"] = nil
		} else {
			updates["branch_id"] = *targetBranchID
		}
	}
	if req.AccountName != nil {
		updates["account_name"] = targetName
	}
	if req.AccountType != nil {
		accountType := strings.TrimSpace(*req.AccountType)
		if !validPaymentAccountType(accountType) {
			return nil, apperrors.BadRequest("invalid account_type", nil)
		}
		updates["account_type"] = accountType
	}
	if req.ChartAccountID != nil {
		updates["chart_account_id"] = targetChartAccountID
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if !validAccountStatus(status) {
			return nil, apperrors.BadRequest("invalid status", nil)
		}
		updates["status"] = status
	}
	if len(updates) == 2 {
		return s.GetPaymentAccount(currentUser, id)
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		if req.ChartAccountID != nil {
			if _, err := s.repo.ValidateActiveAssetChartAccount(tx, currentUser.BusinessID, targetChartAccountID); err != nil {
				if err == gorm.ErrRecordNotFound {
					return apperrors.BadRequest("chart_account_id must reference an active asset account", nil)
				}
				return apperrors.Internal("failed to validate chart account")
			}
		}
		if err := s.repo.UpdatePaymentAccount(tx, currentUser.BusinessID, id, updates); err != nil {
			return mapPaymentAccountNotFound(err)
		}
		return s.writeEntityAudit(tx, currentUser, "payment_account.updated", "payment_account", id, "Payment account updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetPaymentAccount(currentUser, id)
}

func (s *Service) UpdatePaymentAccountStatus(currentUser *utils.AuthContext, id string, req UpdateChartAccountStatusRequest, ipAddress, userAgent string) (*PaymentAccountResponse, error) {
	if !validAccountStatus(strings.TrimSpace(req.Status)) {
		return nil, apperrors.BadRequest("invalid status", nil)
	}
	account, err := s.repo.FindPaymentAccountByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapPaymentAccountNotFound(err)
	}
	if account.BranchID != nil && *account.BranchID != "" && !currentUser.CanAccessBranch(*account.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	if err := s.withTransaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{"status": strings.TrimSpace(req.Status), "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC()}
		if err := s.repo.UpdatePaymentAccount(tx, currentUser.BusinessID, id, updates); err != nil {
			return mapPaymentAccountNotFound(err)
		}
		return s.writeEntityAudit(tx, currentUser, "payment_account.status_updated", "payment_account", id, "Payment account status updated.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetPaymentAccount(currentUser, id)
}

func (s *Service) DeletePaymentAccount(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	account, err := s.repo.FindPaymentAccountByID(currentUser.BusinessID, id)
	if err != nil {
		return mapPaymentAccountNotFound(err)
	}
	if account.BranchID != nil && *account.BranchID != "" && !currentUser.CanAccessBranch(*account.BranchID) {
		return apperrors.Forbidden("branch access denied")
	}
	return s.withTransaction(func(tx *gorm.DB) error {
		count, err := s.repo.CountPaymentMethodsUsingPaymentAccount(tx, currentUser.BusinessID, id)
		if err != nil {
			return apperrors.Internal("failed to validate payment method links")
		}
		if count > 0 {
			return apperrors.Conflict("payment account is linked to payment methods; unlink it before deleting", nil)
		}
		updates := map[string]interface{}{"status": "inactive", "updated_by_user_id": currentUser.UserID, "updated_at": time.Now().UTC(), "deleted_at": gorm.DeletedAt{Time: time.Now().UTC(), Valid: true}}
		if err := s.repo.UpdatePaymentAccount(tx, currentUser.BusinessID, id, updates); err != nil {
			return mapPaymentAccountNotFound(err)
		}
		return s.writeEntityAudit(tx, currentUser, "payment_account.deleted", "payment_account", id, "Payment account deleted.", ipAddress, userAgent)
	})
}

func (s *Service) ListAccountTransfers(currentUser *utils.AuthContext, query AccountTransferListQuery) (*PaginatedResponse[AccountTransferResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.PaymentAccountID = strings.TrimSpace(query.PaymentAccountID)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}
	if err := s.validateAccountTransferFilters(currentUser, query); err != nil {
		return nil, err
	}
	transfers, total, err := s.repo.ListAccountTransfers(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list account transfers")
	}
	items, err := s.repo.LoadAccountTransferResponses(currentUser.BusinessID, transfers)
	if err != nil {
		return nil, apperrors.Internal("failed to load account transfer details")
	}
	return &PaginatedResponse[AccountTransferResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreateAccountTransfer(currentUser *utils.AuthContext, req CreateAccountTransferRequest, ipAddress, userAgent string) (*AccountTransferResponse, error) {
	transferDate, err := parseRequiredDate(req.TransferDate, "transfer_date")
	if err != nil {
		return nil, err
	}
	amount := roundMoney(req.Amount)
	if amount <= 0 {
		return nil, apperrors.BadRequest("amount must be greater than 0", nil)
	}
	fromID := strings.TrimSpace(req.FromPaymentAccountID)
	toID := strings.TrimSpace(req.ToPaymentAccountID)
	if fromID == toID {
		return nil, apperrors.BadRequest("from_payment_account_id and to_payment_account_id cannot be the same", nil)
	}
	fromAccount, err := s.loadActivePaymentAccount(currentUser, fromID)
	if err != nil {
		return nil, err
	}
	toAccount, err := s.loadActivePaymentAccount(currentUser, toID)
	if err != nil {
		return nil, err
	}
	branchID, err := s.resolvePaymentOperationBranch(currentUser, cleanStringPointer(req.BranchID), fromAccount, toAccount)
	if err != nil {
		return nil, err
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		transferNumber, err := s.repo.NextAccountTransferNumber(tx, currentUser.BusinessID, transferDate)
		if err != nil {
			return apperrors.Internal("failed to generate transfer number")
		}
		transferID := utils.NewUUID()
		transfer := &AccountTransfer{
			ID:                   transferID,
			BusinessID:           currentUser.BusinessID,
			BranchID:             branchID,
			TransferNumber:       transferNumber,
			TransferDate:         transferDate,
			FromPaymentAccountID: fromAccount.ID,
			ToPaymentAccountID:   toAccount.ID,
			FromChartAccountID:   fromAccount.ChartAccountID,
			ToChartAccountID:     toAccount.ChartAccountID,
			Amount:               amount,
			ReferenceNumber:      strings.TrimSpace(req.ReferenceNumber),
			Notes:                strings.TrimSpace(req.Notes),
			Status:               "completed",
			CreatedByUserID:      currentUser.UserID,
		}
		if err := s.repo.CreateAccountTransfer(tx, transfer); err != nil {
			return apperrors.Internal("failed to create account transfer")
		}
		journalID, err := s.createPostedTransferJournal(tx, currentUser, transferDate, branchID, "account_transfer", transferID, transferNumber, "Fund transfer "+transferNumber, []JournalEntryLineRequest{
			{AccountID: toAccount.ChartAccountID, DebitAmount: amount, Description: "Transfer in from " + fromAccount.AccountName},
			{AccountID: fromAccount.ChartAccountID, CreditAmount: amount, Description: "Transfer out to " + toAccount.AccountName},
		})
		if err != nil {
			return err
		}
		if err := s.repo.UpdateAccountTransfer(tx, currentUser.BusinessID, transferID, map[string]interface{}{"journal_entry_id": journalID, "updated_at": time.Now().UTC()}); err != nil {
			return mapPaymentAccountNotFound(err)
		}
		createdID = transferID
		return s.writeEntityAudit(tx, currentUser, "account_transfer.created", "account_transfer", transferID, "Account transfer created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetAccountTransfer(currentUser, createdID)
}

func (s *Service) GetAccountTransfer(currentUser *utils.AuthContext, id string) (*AccountTransferResponse, error) {
	transfer, err := s.repo.FindAccountTransferByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapAccountTransferNotFound(err)
	}
	if transfer.BranchID != nil && *transfer.BranchID != "" && !currentUser.CanAccessBranch(*transfer.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	response, err := s.repo.LoadAccountTransferResponse(currentUser.BusinessID, *transfer)
	if err != nil {
		return nil, apperrors.Internal("failed to load account transfer details")
	}
	return &response, nil
}

func (s *Service) ListPlatformSettlements(currentUser *utils.AuthContext, query PlatformSettlementListQuery) (*PaginatedResponse[PlatformSettlementResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.PlatformPaymentAccountID = strings.TrimSpace(query.PlatformPaymentAccountID)
	query.DepositPaymentAccountID = strings.TrimSpace(query.DepositPaymentAccountID)
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder == "" {
		query.SortOrder = "desc"
	}
	if err := s.validatePlatformSettlementFilters(currentUser, query); err != nil {
		return nil, err
	}
	settlements, total, err := s.repo.ListPlatformSettlements(currentUser.BusinessID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to list platform settlements")
	}
	items, err := s.repo.LoadPlatformSettlementResponses(currentUser.BusinessID, settlements)
	if err != nil {
		return nil, apperrors.Internal("failed to load platform settlement details")
	}
	return &PaginatedResponse[PlatformSettlementResponse]{Items: items, Pagination: PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)}}, nil
}

func (s *Service) CreatePlatformSettlement(currentUser *utils.AuthContext, req CreatePlatformSettlementRequest, ipAddress, userAgent string) (*PlatformSettlementResponse, error) {
	settlementDate, err := parseRequiredDate(req.SettlementDate, "settlement_date")
	if err != nil {
		return nil, err
	}
	grossAmount := roundMoney(req.GrossAmount)
	netReceived := roundMoney(req.NetReceivedAmount)
	if grossAmount <= 0 {
		return nil, apperrors.BadRequest("gross_amount must be greater than 0", nil)
	}
	if netReceived < 0 {
		return nil, apperrors.BadRequest("net_received_amount cannot be negative", nil)
	}
	platformAccount, err := s.loadActivePaymentAccount(currentUser, strings.TrimSpace(req.PlatformPaymentAccountID))
	if err != nil {
		return nil, err
	}
	if platformAccount.AccountType != "platform_clearing" {
		return nil, apperrors.BadRequest("platform_payment_account_id must reference a platform_clearing payment account", nil)
	}
	depositAccount, err := s.loadActivePaymentAccount(currentUser, strings.TrimSpace(req.DepositPaymentAccountID))
	if err != nil {
		return nil, err
	}
	if platformAccount.ID == depositAccount.ID {
		return nil, apperrors.BadRequest("platform_payment_account_id and deposit_payment_account_id cannot be the same", nil)
	}
	if depositAccount.AccountType == "platform_clearing" {
		return nil, apperrors.BadRequest("deposit_payment_account_id cannot be another platform_clearing account", nil)
	}
	branchID, err := s.resolvePaymentOperationBranch(currentUser, cleanStringPointer(req.BranchID), platformAccount, depositAccount)
	if err != nil {
		return nil, err
	}
	deductions, journalDeductionLines, deductionsTotal, err := s.buildPlatformSettlementDeductions(currentUser.BusinessID, req.Deductions)
	if err != nil {
		return nil, err
	}
	if roundMoney(netReceived+deductionsTotal) != grossAmount {
		return nil, apperrors.BadRequest("net_received_amount plus deductions must equal gross_amount", map[string]interface{}{"gross_amount": grossAmount, "net_received_amount": netReceived, "deductions_total": deductionsTotal})
	}
	var createdID string
	if err := s.withTransaction(func(tx *gorm.DB) error {
		settlementNumber, err := s.repo.NextPlatformSettlementNumber(tx, currentUser.BusinessID, settlementDate)
		if err != nil {
			return apperrors.Internal("failed to generate settlement number")
		}
		settlementID := utils.NewUUID()
		settlement := &PlatformSettlement{
			ID:                       settlementID,
			BusinessID:               currentUser.BusinessID,
			BranchID:                 branchID,
			SettlementNumber:         settlementNumber,
			SettlementDate:           settlementDate,
			PlatformPaymentAccountID: platformAccount.ID,
			DepositPaymentAccountID:  depositAccount.ID,
			PlatformChartAccountID:   platformAccount.ChartAccountID,
			DepositChartAccountID:    depositAccount.ChartAccountID,
			GrossAmount:              grossAmount,
			DeductionsTotal:          deductionsTotal,
			NetReceivedAmount:        netReceived,
			ReferenceNumber:          strings.TrimSpace(req.ReferenceNumber),
			Notes:                    strings.TrimSpace(req.Notes),
			Status:                   "completed",
			CreatedByUserID:          currentUser.UserID,
		}
		for i := range deductions {
			deductions[i].PlatformSettlementID = settlementID
		}
		if err := s.repo.CreatePlatformSettlement(tx, settlement, deductions); err != nil {
			return apperrors.Internal("failed to create platform settlement")
		}
		lines := make([]JournalEntryLineRequest, 0, len(journalDeductionLines)+2)
		if netReceived > 0 {
			lines = append(lines, JournalEntryLineRequest{AccountID: depositAccount.ChartAccountID, DebitAmount: netReceived, Description: "Settlement received into " + depositAccount.AccountName})
		}
		lines = append(lines, journalDeductionLines...)
		lines = append(lines, JournalEntryLineRequest{AccountID: platformAccount.ChartAccountID, CreditAmount: grossAmount, Description: "Platform settlement from " + platformAccount.AccountName})
		journalID, err := s.createPostedTransferJournal(tx, currentUser, settlementDate, branchID, "platform_settlement", settlementID, settlementNumber, "Platform settlement "+settlementNumber, lines)
		if err != nil {
			return err
		}
		if err := s.repo.UpdatePlatformSettlement(tx, currentUser.BusinessID, settlementID, map[string]interface{}{"journal_entry_id": journalID, "updated_at": time.Now().UTC()}); err != nil {
			return mapPlatformSettlementNotFound(err)
		}
		createdID = settlementID
		return s.writeEntityAudit(tx, currentUser, "platform_settlement.created", "platform_settlement", settlementID, "Platform settlement created.", ipAddress, userAgent)
	}); err != nil {
		return nil, err
	}
	return s.GetPlatformSettlement(currentUser, createdID)
}

func (s *Service) GetPlatformSettlement(currentUser *utils.AuthContext, id string) (*PlatformSettlementResponse, error) {
	settlement, err := s.repo.FindPlatformSettlementByID(currentUser.BusinessID, id)
	if err != nil {
		return nil, mapPlatformSettlementNotFound(err)
	}
	if settlement.BranchID != nil && *settlement.BranchID != "" && !currentUser.CanAccessBranch(*settlement.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	response, err := s.repo.LoadPlatformSettlementResponse(currentUser.BusinessID, *settlement)
	if err != nil {
		return nil, apperrors.Internal("failed to load platform settlement details")
	}
	return &response, nil
}

func (s *Service) PostPOSSaleJournal(tx *gorm.DB, currentUser *utils.AuthContext, saleID string) (string, error) {
	sale, err := s.repo.FindPOSSaleForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(saleID))
	if err != nil {
		return "", apperrors.Internal("failed to load sale for accounting")
	}
	if sale.AccountingJournalEntryID != nil && *sale.AccountingJournalEntryID != "" {
		return *sale.AccountingJournalEntryID, nil
	}
	if sale.SaleStatus != "completed" {
		return "", nil
	}
	totalAmount := roundMoney(sale.TotalAmount)
	if totalAmount <= 0 {
		return "", nil
	}
	payments, err := s.repo.ListPOSSalePaymentsForAccounting(tx, currentUser.BusinessID, sale.ID)
	if err != nil {
		return "", apperrors.Internal("failed to load sale payments for accounting")
	}
	salesIncome, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "sales_income", "4000", "Sales Income")
	if err != nil {
		return "", err
	}
	accountsReceivable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_receivable", "1100", "Accounts Receivable")
	if err != nil {
		return "", err
	}
	var vatPayable *ChartAccount
	taxAmount := roundMoney(sale.TaxAmount)
	if taxAmount > 0 {
		vatPayable, err = s.requiredMappedAccount(tx, currentUser.BusinessID, "vat_payable", "2100", "VAT Payable")
		if err != nil {
			return "", err
		}
	}
	collectedTotal := roundMoney(sale.PaidAmount - sale.ChangeAmount)
	if collectedTotal < 0 {
		collectedTotal = 0
	}
	if collectedTotal > totalAmount {
		collectedTotal = totalAmount
	}

	paymentDebits := map[string]float64{}
	paymentDescriptions := map[string]string{}
	remainingChange := roundMoney(sale.ChangeAmount)
	for _, payment := range payments {
		if payment.DefaultPaymentAccountID == nil || strings.TrimSpace(payment.ChartAccountID) == "" {
			return "", apperrors.BadRequest("payment method is not linked to an active payment account", map[string]interface{}{"payment_method": payment.PaymentMethodNameSnapshot})
		}
		if err := validatePaymentAccountBranch(payment.PaymentAccountBranchID, sale.BranchID, payment.PaymentAccountName); err != nil {
			return "", err
		}
		amount := roundMoney(payment.Amount)
		if payment.PaymentMethodTypeSnapshot == "cash" && remainingChange > 0 {
			reduction := amount
			if remainingChange < reduction {
				reduction = remainingChange
			}
			amount = roundMoney(amount - reduction)
			remainingChange = roundMoney(remainingChange - reduction)
		}
		if amount <= 0 {
			continue
		}
		paymentDebits[payment.ChartAccountID] = roundMoney(paymentDebits[payment.ChartAccountID] + amount)
		if paymentDescriptions[payment.ChartAccountID] == "" {
			paymentDescriptions[payment.ChartAccountID] = "Collected via " + payment.PaymentMethodNameSnapshot
		}
	}

	chargeLines, chargeNetAmount, err := s.buildChargeCreditLines(tx, currentUser.BusinessID, "pos_sale", sale.ID, "POS sale charge")
	if err != nil {
		return "", err
	}

	lines := make([]JournalEntryLineRequest, 0, len(paymentDebits)+3+len(chargeLines))
	for accountID, amount := range paymentDebits {
		if amount > 0 {
			lines = append(lines, JournalEntryLineRequest{AccountID: accountID, DebitAmount: amount, Description: paymentDescriptions[accountID]})
		}
	}
	balanceAmount := roundMoney(totalAmount - collectedTotal)
	if balanceAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: accountsReceivable.ID, DebitAmount: balanceAmount, Description: "POS sale receivable"})
	}
	revenueAmount := roundMoney(totalAmount - taxAmount - chargeNetAmount)
	if revenueAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: salesIncome.ID, CreditAmount: revenueAmount, Description: "POS sale income"})
	}
	lines = append(lines, chargeLines...)
	if vatPayable != nil {
		lines = append(lines, JournalEntryLineRequest{AccountID: vatPayable.ID, CreditAmount: taxAmount, Description: "VAT payable on POS sale"})
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, sale.SoldAt, &sale.BranchID, "pos_sale", sale.ID, sale.SaleNumber, "POS sale "+sale.SaleNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePOSSaleAccountingJournalID(tx, currentUser.BusinessID, sale.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sale accounting journal")
	}
	if err := s.repo.UpdatePOSSalePaymentJournalIDs(tx, currentUser.BusinessID, sale.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sale payment accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostPOSSaleCOGSJournal(tx *gorm.DB, currentUser *utils.AuthContext, saleID string) (string, error) {
	sale, err := s.repo.FindPOSSaleForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(saleID))
	if err != nil {
		return "", apperrors.Internal("failed to load sale for COGS accounting")
	}
	if sale.COGSJournalEntryID != nil && *sale.COGSJournalEntryID != "" {
		return *sale.COGSJournalEntryID, nil
	}
	if sale.SaleStatus != "completed" {
		return "", nil
	}
	costTotal, err := s.repo.SumStockMovementCostByReference(tx, currentUser.BusinessID, "sale", sale.ID, "out")
	if err != nil {
		return "", apperrors.Internal("failed to calculate sale inventory cost")
	}
	costTotal = roundMoney(costTotal)
	if costTotal <= 0 {
		return "", nil
	}
	cogsAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "cogs", "5070", "Cost of Goods Sold")
	if err != nil {
		return "", err
	}
	inventoryAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_stock", "1200", "Inventory / Stock")
	if err != nil {
		return "", err
	}
	lines := []JournalEntryLineRequest{
		{AccountID: cogsAccount.ID, DebitAmount: costTotal, Description: "COGS for " + sale.SaleNumber},
		{AccountID: inventoryAccount.ID, CreditAmount: costTotal, Description: "Inventory cost relieved for " + sale.SaleNumber},
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, sale.SoldAt, &sale.BranchID, "pos_sale_cogs", sale.ID, sale.SaleNumber, "POS sale COGS "+sale.SaleNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePOSSaleCOGSJournalID(tx, currentUser.BusinessID, sale.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sale COGS journal")
	}
	if err := s.repo.UpdateStockMovementJournalByReference(tx, currentUser.BusinessID, "sale", sale.ID, "out", journalID); err != nil {
		return "", apperrors.Internal("failed to link sale stock movements to COGS journal")
	}
	return journalID, nil
}

func (s *Service) PostPOSSaleVoidJournal(tx *gorm.DB, currentUser *utils.AuthContext, saleID string, voidDate time.Time) (string, error) {
	sale, err := s.repo.FindPOSSaleForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(saleID))
	if err != nil {
		return "", apperrors.Internal("failed to load sale for void accounting")
	}
	if sale.VoidJournalEntryID != nil && *sale.VoidJournalEntryID != "" {
		return *sale.VoidJournalEntryID, nil
	}
	sourceJournalIDs := []string{}
	if sale.AccountingJournalEntryID != nil && strings.TrimSpace(*sale.AccountingJournalEntryID) != "" {
		sourceJournalIDs = append(sourceJournalIDs, strings.TrimSpace(*sale.AccountingJournalEntryID))
	}
	if sale.COGSJournalEntryID != nil && strings.TrimSpace(*sale.COGSJournalEntryID) != "" {
		sourceJournalIDs = append(sourceJournalIDs, strings.TrimSpace(*sale.COGSJournalEntryID))
	}
	if len(sourceJournalIDs) == 0 {
		return "", nil
	}
	lines := make([]JournalEntryLineRequest, 0)
	for _, journalID := range sourceJournalIDs {
		sourceLines, err := s.repo.ListJournalEntryLines(currentUser.BusinessID, journalID)
		if err != nil {
			return "", apperrors.Internal("failed to load source journal lines for void")
		}
		for _, line := range sourceLines {
			if line.CreditAmount > 0 {
				lines = append(lines, JournalEntryLineRequest{AccountID: line.AccountID, DebitAmount: roundMoney(line.CreditAmount), Description: "Void reversal: " + line.Description})
			}
			if line.DebitAmount > 0 {
				lines = append(lines, JournalEntryLineRequest{AccountID: line.AccountID, CreditAmount: roundMoney(line.DebitAmount), Description: "Void reversal: " + line.Description})
			}
		}
	}
	if len(lines) == 0 {
		return "", nil
	}
	if voidDate.IsZero() {
		voidDate = time.Now().UTC()
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, voidDate, &sale.BranchID, "pos_sale_void", sale.ID, sale.SaleNumber, "POS sale void "+sale.SaleNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePOSSaleVoidJournalID(tx, currentUser.BusinessID, sale.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sale void journal")
	}
	return journalID, nil
}

func (s *Service) PostPOSPaymentRefundJournal(tx *gorm.DB, currentUser *utils.AuthContext, paymentRefundID string) (string, error) {
	refund, err := s.repo.FindPOSPaymentRefundForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(paymentRefundID))
	if err != nil {
		return "", apperrors.Internal("failed to load payment refund for accounting")
	}
	if refund.RefundSource == "sales_return" {
		return "", nil
	}
	if refund.JournalEntryID != nil && strings.TrimSpace(*refund.JournalEntryID) != "" {
		return strings.TrimSpace(*refund.JournalEntryID), nil
	}
	if refund.RefundStatus != "completed" {
		return "", nil
	}
	refundAmount := roundMoney(refund.RefundAmount)
	if refundAmount <= 0 {
		return "", apperrors.BadRequest("completed payment refund must have a positive amount before accounting can be posted", map[string]interface{}{"payment_refund_id": refund.ID, "refund_amount": refundAmount})
	}
	if refund.DefaultPaymentAccountID == nil || strings.TrimSpace(refund.ChartAccountID) == "" {
		return "", apperrors.BadRequest("refund payment method is not linked to an active payment account", map[string]interface{}{"payment_method": refund.PaymentMethodNameSnapshot})
	}
	if err := validatePaymentAccountBranch(refund.PaymentAccountBranchID, refund.BranchID, refund.PaymentAccountName); err != nil {
		return "", err
	}
	existing, err := s.repo.FindPostedJournalBySource(tx, currentUser.BusinessID, "pos_sale_refund", refund.ID)
	if err == nil && existing.ID != "" {
		if err := s.repo.UpdatePOSPaymentRefundJournalID(tx, currentUser.BusinessID, refund.ID, existing.ID); err != nil {
			return "", apperrors.Internal("failed to update payment refund accounting journal")
		}
		return existing.ID, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return "", apperrors.Internal("failed to validate existing payment refund journal")
	}
	salesReturnsAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "sales_returns", "4040", "Sales Returns and Allowances")
	if err != nil {
		return "", err
	}
	lines := []JournalEntryLineRequest{
		{AccountID: salesReturnsAccount.ID, DebitAmount: refundAmount, Description: "POS refund allowance " + refund.RefundNumber},
		{AccountID: refund.ChartAccountID, CreditAmount: refundAmount, Description: "POS refund via " + refund.PaymentMethodNameSnapshot},
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, refund.RefundedAt, &refund.BranchID, "pos_sale_refund", refund.ID, refund.RefundNumber, "POS refund "+refund.RefundNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePOSPaymentRefundJournalID(tx, currentUser.BusinessID, refund.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update payment refund accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostSalesReturnInventoryJournal(tx *gorm.DB, currentUser *utils.AuthContext, salesReturnID string) (string, error) {
	salesReturn, err := s.repo.FindSalesReturnForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(salesReturnID))
	if err != nil {
		return "", apperrors.Internal("failed to load sales return for inventory accounting")
	}
	if salesReturn.InventoryJournalEntryID != nil && *salesReturn.InventoryJournalEntryID != "" {
		return *salesReturn.InventoryJournalEntryID, nil
	}
	if salesReturn.Status != "posted" {
		return "", nil
	}
	costTotal, err := s.repo.SumStockMovementCostByReference(tx, currentUser.BusinessID, "sales_return", salesReturn.ID, "in")
	if err != nil {
		return "", apperrors.Internal("failed to calculate sales return inventory value")
	}
	costTotal = roundMoney(costTotal)
	if costTotal <= 0 {
		return "", nil
	}
	inventoryAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_stock", "1200", "Inventory / Stock")
	if err != nil {
		return "", err
	}
	cogsAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "cogs", "5070", "Cost of Goods Sold")
	if err != nil {
		return "", err
	}
	lines := []JournalEntryLineRequest{
		{AccountID: inventoryAccount.ID, DebitAmount: costTotal, Description: "Inventory restored for " + salesReturn.ReturnNumber},
		{AccountID: cogsAccount.ID, CreditAmount: costTotal, Description: "COGS reversed for " + salesReturn.ReturnNumber},
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, salesReturn.ReturnDate, &salesReturn.BranchID, "sales_return_inventory", salesReturn.ID, salesReturn.ReturnNumber, "Sales return inventory "+salesReturn.ReturnNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateSalesReturnInventoryJournalID(tx, currentUser.BusinessID, salesReturn.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sales return inventory journal")
	}
	if err := s.repo.UpdateStockMovementJournalByReference(tx, currentUser.BusinessID, "sales_return", salesReturn.ID, "in", journalID); err != nil {
		return "", apperrors.Internal("failed to link sales return stock movements to inventory journal")
	}
	return journalID, nil
}

func (s *Service) PostBakeryOrderPaymentJournal(tx *gorm.DB, currentUser *utils.AuthContext, paymentID string) (string, error) {
	payment, err := s.repo.FindBakeryPaymentForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(paymentID))
	if err != nil {
		return "", apperrors.Internal("failed to load bakery order payment for accounting")
	}
	if payment.JournalEntryID != nil && *payment.JournalEntryID != "" {
		return *payment.JournalEntryID, nil
	}
	amount := roundMoney(payment.Amount)
	if amount <= 0 {
		return "", nil
	}
	if payment.DefaultPaymentAccountID == nil || strings.TrimSpace(payment.ChartAccountID) == "" {
		return "", apperrors.BadRequest("payment method is not linked to an active payment account", map[string]interface{}{"payment_method": payment.PaymentMethodNameSnapshot})
	}
	if err := validatePaymentAccountBranch(payment.PaymentAccountBranchID, payment.BranchID, payment.PaymentAccountName); err != nil {
		return "", err
	}
	creditMappingKey := "customer_advance"
	creditAccountCode := "2200"
	creditAccountName := "Customer Advance"
	if payment.OrderStatus == "completed" {
		creditMappingKey = "accounts_receivable"
		creditAccountCode = "1100"
		creditAccountName = "Accounts Receivable"
	}
	creditAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, creditMappingKey, creditAccountCode, creditAccountName)
	if err != nil {
		return "", err
	}
	lines := []JournalEntryLineRequest{
		{AccountID: payment.ChartAccountID, DebitAmount: amount, Description: "Bakery order payment via " + payment.PaymentMethodNameSnapshot},
		{AccountID: creditAccount.ID, CreditAmount: amount, Description: "Bakery order " + payment.PaymentType + " payment"},
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, payment.PaidAt, &payment.BranchID, "bakery_order_payment", payment.ID, payment.OrderNumber, "Bakery order payment "+payment.OrderNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateBakeryPaymentJournalID(tx, currentUser.BusinessID, payment.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update bakery order payment accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostBakeryOrderRevenueJournal(tx *gorm.DB, currentUser *utils.AuthContext, orderID string) (string, error) {
	order, err := s.repo.FindBakeryOrderForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(orderID))
	if err != nil {
		return "", apperrors.Internal("failed to load bakery order for accounting")
	}
	if order.AccountingJournalEntryID != nil && *order.AccountingJournalEntryID != "" {
		return *order.AccountingJournalEntryID, nil
	}
	if order.OrderStatus != "completed" {
		return "", nil
	}
	totalAmount := roundMoney(order.TotalAmount)
	if totalAmount <= 0 {
		return "", nil
	}
	customerAdvance, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "customer_advance", "2200", "Customer Advance")
	if err != nil {
		return "", err
	}
	accountsReceivable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_receivable", "1100", "Accounts Receivable")
	if err != nil {
		return "", err
	}
	bakeryIncome, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "bakery_income", "4010", "Bakery Order Income")
	if err != nil {
		return "", err
	}
	var vatPayable *ChartAccount
	taxAmount := roundMoney(order.TaxAmount)
	if taxAmount > 0 {
		vatPayable, err = s.requiredMappedAccount(tx, currentUser.BusinessID, "vat_payable", "2100", "VAT Payable")
		if err != nil {
			return "", err
		}
	}
	paidAmount := roundMoney(order.PaidAmount)
	if paidAmount > totalAmount {
		paidAmount = totalAmount
	}
	balanceAmount := roundMoney(totalAmount - paidAmount)
	chargeLines, chargeNetAmount, err := s.buildChargeCreditLines(tx, currentUser.BusinessID, "bakery_order", order.ID, "Bakery order charge")
	if err != nil {
		return "", err
	}

	lines := make([]JournalEntryLineRequest, 0, 4+len(chargeLines))
	if paidAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: customerAdvance.ID, DebitAmount: paidAmount, Description: "Recognize paid bakery order advance"})
	}
	if balanceAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: accountsReceivable.ID, DebitAmount: balanceAmount, Description: "Bakery order receivable"})
	}
	revenueAmount := roundMoney(totalAmount - taxAmount - chargeNetAmount)
	if revenueAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: bakeryIncome.ID, CreditAmount: revenueAmount, Description: "Bakery order income"})
	}
	lines = append(lines, chargeLines...)
	if vatPayable != nil {
		lines = append(lines, JournalEntryLineRequest{AccountID: vatPayable.ID, CreditAmount: taxAmount, Description: "VAT payable on bakery order"})
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, time.Now().UTC(), &order.BranchID, "bakery_order_revenue", order.ID, order.OrderNumber, "Bakery order revenue "+order.OrderNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateBakeryOrderAccountingJournalID(tx, currentUser.BusinessID, order.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update bakery order accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostSalesReturnJournal(tx *gorm.DB, currentUser *utils.AuthContext, salesReturnID string) (string, error) {
	salesReturn, err := s.repo.FindSalesReturnForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(salesReturnID))
	if err != nil {
		return "", apperrors.Internal("failed to load sales return for accounting")
	}
	if salesReturn.JournalEntryID != nil && *salesReturn.JournalEntryID != "" {
		return *salesReturn.JournalEntryID, nil
	}
	if salesReturn.Status != "posted" || salesReturn.RefundMode != "refund" {
		return "", nil
	}
	refundAmount := roundMoney(salesReturn.RefundAmount)
	if refundAmount <= 0 {
		refundAmount = roundMoney(salesReturn.ReturnTotal)
	}
	if refundAmount <= 0 {
		return "", nil
	}
	if salesReturn.DefaultPaymentAccountID == nil || strings.TrimSpace(salesReturn.ChartAccountID) == "" {
		return "", apperrors.BadRequest("refund payment method is not linked to an active payment account", map[string]interface{}{"payment_method": salesReturn.RefundPaymentMethodName})
	}
	if err := validatePaymentAccountBranch(salesReturn.PaymentAccountBranchID, salesReturn.BranchID, salesReturn.PaymentAccountName); err != nil {
		return "", err
	}
	salesReturnsAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "sales_returns", "4040", "Sales Returns and Allowances")
	if err != nil {
		return "", err
	}
	taxAmount := roundMoney(salesReturn.TaxAmount)
	chargeLines, chargeNetAmount, err := s.buildChargeRefundDebitLines(tx, currentUser.BusinessID, "sales_return", salesReturn.ID, "Refunded customer charge")
	if err != nil {
		return "", err
	}
	netReturn := roundMoney(refundAmount - taxAmount - chargeNetAmount)
	lines := make([]JournalEntryLineRequest, 0, 3+len(chargeLines))
	if netReturn > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: salesReturnsAccount.ID, DebitAmount: netReturn, Description: "Sales return allowance " + salesReturn.ReturnNumber})
	}
	lines = append(lines, chargeLines...)
	if taxAmount > 0 {
		vatPayable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "vat_payable", "2100", "VAT Payable")
		if err != nil {
			return "", err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: vatPayable.ID, DebitAmount: taxAmount, Description: "VAT reversed on sales return"})
	}
	lines = append(lines, JournalEntryLineRequest{AccountID: salesReturn.ChartAccountID, CreditAmount: refundAmount, Description: "Refund via " + salesReturn.RefundPaymentMethodName})
	journalID, err := s.createPostedSystemJournal(tx, currentUser, salesReturn.ReturnDate, &salesReturn.BranchID, "sales_return", salesReturn.ID, salesReturn.ReturnNumber, "Sales return "+salesReturn.ReturnNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateSalesReturnJournalID(tx, currentUser.BusinessID, salesReturn.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update sales return accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostPurchaseReturnJournal(tx *gorm.DB, currentUser *utils.AuthContext, purchaseReturnID string) (string, error) {
	purchaseReturn, err := s.repo.FindPurchaseReturnForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(purchaseReturnID))
	if err != nil {
		return "", apperrors.Internal("failed to load purchase return for accounting")
	}
	if purchaseReturn.Status != "posted" {
		return "", apperrors.BadRequest("only posted purchase returns can be posted to accounting", map[string]interface{}{"purchase_return_id": purchaseReturn.ID, "status": purchaseReturn.Status})
	}
	returnTotal := roundMoney(purchaseReturn.ReturnTotal)
	if returnTotal <= 0 {
		return "", apperrors.BadRequest("posted purchase return must have a positive total before accounting can be posted", map[string]interface{}{"purchase_return_id": purchaseReturn.ID, "return_total": returnTotal})
	}
	if purchaseReturn.JournalEntryID != nil && strings.TrimSpace(*purchaseReturn.JournalEntryID) != "" {
		journalID := strings.TrimSpace(*purchaseReturn.JournalEntryID)
		entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, journalID)
		if err != nil {
			return "", apperrors.Conflict("linked purchase return journal is missing or invalid; run purchase return journal backfill before posting accounting", map[string]interface{}{"purchase_return_id": purchaseReturn.ID, "journal_entry_id": journalID})
		}
		if err := validatePurchaseReturnPostedJournal(entry, purchaseReturn.ID); err != nil {
			return "", err
		}
		if err := s.syncPurchaseReturnJournalLinks(tx, currentUser.BusinessID, purchaseReturn.ID, journalID); err != nil {
			return "", err
		}
		return journalID, nil
	}
	existing, err := s.repo.FindPostedJournalBySource(tx, currentUser.BusinessID, "purchase_return", purchaseReturn.ID)
	if err == nil && existing.ID != "" {
		if err := validatePurchaseReturnPostedJournal(existing, purchaseReturn.ID); err != nil {
			return "", err
		}
		if err := s.syncPurchaseReturnJournalLinks(tx, currentUser.BusinessID, purchaseReturn.ID, existing.ID); err != nil {
			return "", err
		}
		return existing.ID, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return "", apperrors.Internal("failed to validate existing purchase return accounting journal")
	}
	accountsPayable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_payable", "2000", "Accounts Payable")
	if err != nil {
		return "", err
	}
	inventoryAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_stock", "1200", "Inventory / Stock")
	if err != nil {
		return "", err
	}
	purchaseReturnAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "purchase_returns", "5020", "Purchase Return")
	if err != nil {
		return "", err
	}
	taxAmount := roundMoney(purchaseReturn.TaxAmount)
	chargeLines, chargeNetAmount, err := s.buildPurchaseChargeCreditLines(tx, currentUser.BusinessID, "purchase_return", purchaseReturn.ID, "Vendor credit charge")
	if err != nil {
		return "", err
	}
	inventoryCreditAmount, err := s.repo.SumStockMovementCostByReferenceAndType(tx, currentUser.BusinessID, "purchase_return", purchaseReturn.ID, "purchase_return_out")
	if err != nil {
		return "", apperrors.Internal("failed to load purchase return stock valuation")
	}
	inventoryCreditAmount = roundMoney(inventoryCreditAmount)
	lines := make([]JournalEntryLineRequest, 0, 4+len(chargeLines))
	lines = append(lines, JournalEntryLineRequest{AccountID: accountsPayable.ID, DebitAmount: returnTotal, Description: "Vendor credit " + purchaseReturn.ReturnNumber})
	if inventoryCreditAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: inventoryAccount.ID, CreditAmount: inventoryCreditAmount, Description: "Inventory returned to supplier " + purchaseReturn.ReturnNumber})
	}
	lines = append(lines, chargeLines...)
	if taxAmount > 0 {
		vatReceivable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "vat_receivable", "1300", "VAT Receivable")
		if err != nil {
			return "", err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: vatReceivable.ID, CreditAmount: taxAmount, Description: "VAT receivable reversed on purchase return"})
	}
	creditedAmount := roundMoney(inventoryCreditAmount + chargeNetAmount + taxAmount)
	varianceAmount := roundMoney(returnTotal - creditedAmount)
	if varianceAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: purchaseReturnAccount.ID, CreditAmount: varianceAmount, Description: "Vendor credit price variance " + purchaseReturn.ReturnNumber})
	} else if varianceAmount < 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: purchaseReturnAccount.ID, DebitAmount: roundMoney(-varianceAmount), Description: "Vendor credit price variance " + purchaseReturn.ReturnNumber})
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, purchaseReturn.ReturnDate, &purchaseReturn.BranchID, "purchase_return", purchaseReturn.ID, purchaseReturn.ReturnNumber, "Purchase return "+purchaseReturn.ReturnNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.syncPurchaseReturnJournalLinks(tx, currentUser.BusinessID, purchaseReturn.ID, journalID); err != nil {
		return "", err
	}
	return journalID, nil
}

func validatePurchaseReturnPostedJournal(entry *JournalEntry, purchaseReturnID string) error {
	if entry == nil || strings.TrimSpace(entry.ID) == "" {
		return apperrors.Conflict("linked purchase return journal is missing or invalid; run purchase return journal backfill before posting accounting", map[string]interface{}{"purchase_return_id": strings.TrimSpace(purchaseReturnID)})
	}
	sourceID := ""
	if entry.SourceID != nil {
		sourceID = strings.TrimSpace(*entry.SourceID)
	}
	if strings.TrimSpace(entry.SourceType) != "purchase_return" || sourceID != strings.TrimSpace(purchaseReturnID) || strings.TrimSpace(entry.Status) != "posted" {
		return apperrors.Conflict("linked purchase return journal is not a posted Vendor Credit journal", map[string]interface{}{
			"purchase_return_id": strings.TrimSpace(purchaseReturnID),
			"journal_entry_id":   entry.ID,
			"source_type":        entry.SourceType,
			"source_id":          sourceID,
			"status":             entry.Status,
		})
	}
	return nil
}

func (s *Service) syncPurchaseReturnJournalLinks(tx *gorm.DB, businessID, purchaseReturnID, journalID string) error {
	if err := s.repo.UpdatePurchaseReturnJournalID(tx, businessID, purchaseReturnID, journalID); err != nil {
		return apperrors.Internal("failed to update purchase return accounting journal")
	}
	if err := s.repo.UpdateStockMovementJournalByReference(tx, businessID, "purchase_return", purchaseReturnID, "out", journalID); err != nil {
		return apperrors.Internal("failed to update purchase return stock movement journal")
	}
	return nil
}

func (s *Service) PostPurchaseInvoiceJournal(tx *gorm.DB, currentUser *utils.AuthContext, invoiceID string) (string, error) {
	invoice, err := s.repo.FindPurchaseInvoiceForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(invoiceID))
	if err != nil {
		return "", apperrors.Internal("failed to load purchase invoice for accounting")
	}
	if invoice.JournalEntryID != nil && *invoice.JournalEntryID != "" {
		return *invoice.JournalEntryID, nil
	}
	if invoice.Status != "posted" {
		return "", nil
	}
	totalAmount := roundMoney(invoice.TotalAmount)
	if totalAmount <= 0 {
		return "", nil
	}
	lines, err := s.buildPurchaseInvoiceJournalLineRequests(tx, currentUser.BusinessID, invoice)
	if err != nil {
		return "", err
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, invoice.InvoiceDate, &invoice.BranchID, "purchase_invoice", invoice.ID, invoice.InvoiceNumber, "Purchase invoice "+invoice.InvoiceNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePurchaseInvoiceJournalID(tx, currentUser.BusinessID, invoice.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update purchase invoice accounting journal")
	}
	return journalID, nil
}

func (s *Service) RefreshPurchaseInvoiceJournalAfterEdit(tx *gorm.DB, currentUser *utils.AuthContext, invoiceID string) (string, error) {
	invoice, err := s.repo.FindPurchaseInvoiceForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(invoiceID))
	if err != nil {
		return "", apperrors.Internal("failed to load purchase invoice for accounting")
	}
	if invoice.Status != "posted" {
		return "", nil
	}
	totalAmount := roundMoney(invoice.TotalAmount)
	if totalAmount <= 0 {
		return "", nil
	}
	if invoice.JournalEntryID != nil && strings.TrimSpace(*invoice.JournalEntryID) != "" {
		if _, err := s.reversePostedJournalInTx(tx, currentUser, strings.TrimSpace(*invoice.JournalEntryID), "purchase_invoice_edit_reverse", "Purchase invoice edit reversal "+invoice.InvoiceNumber); err != nil {
			return "", err
		}
	}
	lines, err := s.buildPurchaseInvoiceJournalLineRequests(tx, currentUser.BusinessID, invoice)
	if err != nil {
		return "", err
	}
	editSourceID := utils.NewUUID()
	journalID, err := s.createPostedSystemJournal(tx, currentUser, invoice.InvoiceDate, &invoice.BranchID, "purchase_invoice_edit", editSourceID, invoice.InvoiceNumber, "Purchase invoice edit "+invoice.InvoiceNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePurchaseInvoiceJournalID(tx, currentUser.BusinessID, invoice.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update purchase invoice accounting journal")
	}
	return journalID, nil
}

func (s *Service) buildPurchaseInvoiceJournalLineRequests(tx *gorm.DB, businessID string, invoice *purchaseInvoiceAccountingRow) ([]JournalEntryLineRequest, error) {
	totalAmount := roundMoney(invoice.TotalAmount)
	accountsPayable, err := s.requiredMappedAccount(tx, businessID, "accounts_payable", "2000", "Accounts Payable")
	if err != nil {
		return nil, err
	}
	taxAmount := roundMoney(invoice.TaxAmount)
	chargeLines, _, err := s.buildPurchaseChargeDebitLines(tx, businessID, "purchase_invoice", invoice.ID, "Purchase invoice charge")
	if err != nil {
		return nil, err
	}
	valueLines, err := s.buildPurchaseInvoiceValueLines(tx, businessID, invoice, false)
	if err != nil {
		return nil, err
	}
	lines := make([]JournalEntryLineRequest, 0, len(valueLines)+2+len(chargeLines))
	lines = append(lines, valueLines...)
	lines = append(lines, chargeLines...)
	if taxAmount > 0 {
		vatReceivable, err := s.requiredMappedAccount(tx, businessID, "vat_receivable", "1300", "VAT Receivable")
		if err != nil {
			return nil, err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: vatReceivable.ID, DebitAmount: taxAmount, Description: "VAT receivable on purchase invoice"})
	}
	lines = append(lines, JournalEntryLineRequest{AccountID: accountsPayable.ID, CreditAmount: totalAmount, Description: "Supplier payable " + invoice.InvoiceNumber})
	return lines, nil
}

func (s *Service) ReversePurchaseReturnJournal(tx *gorm.DB, currentUser *utils.AuthContext, journalEntryID, returnNumber string) (string, error) {
	return s.reversePostedJournalInTx(tx, currentUser, journalEntryID, "purchase_return_reversal", "Vendor credit reversal "+strings.TrimSpace(returnNumber))
}

func (s *Service) reversePostedJournalInTx(tx *gorm.DB, currentUser *utils.AuthContext, journalEntryID, sourceType, narration string) (string, error) {
	entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, strings.TrimSpace(journalEntryID))
	if err != nil {
		return "", apperrors.Internal("failed to load accounting journal")
	}
	if entry.Status == "reversed" {
		return "", nil
	}
	if entry.Status != "posted" {
		return "", apperrors.BadRequest("only posted journals can be reversed", nil)
	}
	lines, err := s.repo.ListJournalEntryLinesForUpdate(tx, currentUser.BusinessID, entry.ID)
	if err != nil {
		return "", apperrors.Internal("failed to load accounting journal lines")
	}
	reversalEntryNumber, err := s.repo.NextJournalEntryNumber(tx, currentUser.BusinessID, time.Now().UTC())
	if err != nil {
		return "", apperrors.Internal("failed to generate reversal journal entry number")
	}
	reversalID := utils.NewUUID()
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
	now := time.Now().UTC()
	reversal := &JournalEntry{
		ID:              reversalID,
		BusinessID:      currentUser.BusinessID,
		BranchID:        entry.BranchID,
		EntryNumber:     reversalEntryNumber,
		EntryDate:       now,
		ReferenceNumber: entry.ReferenceNumber,
		SourceType:      sourceType,
		SourceID:        &entry.ID,
		Narration:       strings.TrimSpace(narration),
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
		return "", apperrors.Internal("failed to create reversal journal")
	}
	if err := s.repo.UpdateJournalEntry(tx, currentUser.BusinessID, entry.ID, map[string]interface{}{"status": "reversed", "reversed_at": now, "reversed_by_user_id": currentUser.UserID, "updated_by_user_id": currentUser.UserID, "updated_at": now}); err != nil {
		return "", apperrors.Internal("failed to mark journal reversed")
	}
	return reversalID, nil
}

func (s *Service) PostPurchaseInvoiceCancellationJournal(tx *gorm.DB, currentUser *utils.AuthContext, invoiceID string) (string, error) {
	invoice, err := s.repo.FindPurchaseInvoiceForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(invoiceID))
	if err != nil {
		return "", apperrors.Internal("failed to load purchase invoice for accounting")
	}
	if invoice.ReversalJournalEntryID != nil && *invoice.ReversalJournalEntryID != "" {
		return *invoice.ReversalJournalEntryID, nil
	}
	if invoice.Status != "posted" && invoice.Status != "cancelled" {
		return "", nil
	}
	totalAmount := roundMoney(invoice.TotalAmount)
	if totalAmount <= 0 {
		return "", nil
	}
	if invoice.JournalEntryID == nil || strings.TrimSpace(*invoice.JournalEntryID) == "" {
		if invoice.Status != "posted" {
			return "", apperrors.BadRequest("purchase invoice has no original accounting journal to reverse", nil)
		}
		if _, err := s.PostPurchaseInvoiceJournal(tx, currentUser, invoice.ID); err != nil {
			return "", err
		}
	}
	accountsPayable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_payable", "2000", "Accounts Payable")
	if err != nil {
		return "", err
	}
	taxAmount := roundMoney(invoice.TaxAmount)
	chargeLines, _, err := s.buildPurchaseChargeCreditLines(tx, currentUser.BusinessID, "purchase_invoice", invoice.ID, "Purchase invoice cancellation charge")
	if err != nil {
		return "", err
	}
	valueLines, err := s.buildPurchaseInvoiceValueLines(tx, currentUser.BusinessID, invoice, true)
	if err != nil {
		return "", err
	}
	lines := make([]JournalEntryLineRequest, 0, len(valueLines)+2+len(chargeLines))
	lines = append(lines, JournalEntryLineRequest{AccountID: accountsPayable.ID, DebitAmount: totalAmount, Description: "Supplier payable reversed " + invoice.InvoiceNumber})
	lines = append(lines, valueLines...)
	lines = append(lines, chargeLines...)
	if taxAmount > 0 {
		vatReceivable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "vat_receivable", "1300", "VAT Receivable")
		if err != nil {
			return "", err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: vatReceivable.ID, CreditAmount: taxAmount, Description: "VAT receivable reversed on purchase invoice cancellation"})
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, time.Now().UTC(), &invoice.BranchID, "purchase_invoice_cancel", invoice.ID, invoice.InvoiceNumber, "Purchase invoice cancellation "+invoice.InvoiceNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePurchaseInvoiceReversalJournalID(tx, currentUser.BusinessID, invoice.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update purchase invoice reversal journal")
	}
	return journalID, nil
}

func (s *Service) buildPurchaseInvoiceValueLines(tx *gorm.DB, businessID string, invoice *purchaseInvoiceAccountingRow, reverse bool) ([]JournalEntryLineRequest, error) {
	items, err := s.repo.ListPurchaseInvoiceItemsForAccounting(tx, businessID, invoice.ID)
	if err != nil {
		return nil, apperrors.Internal("failed to load purchase invoice items for accounting")
	}
	lineNetTotal := 0.0
	for _, item := range items {
		lineNetTotal += roundMoney(item.LineTotal - item.TaxAmount)
	}
	lineNetTotal = roundMoney(lineNetTotal)
	billDiscount := roundMoney(invoice.BillDiscountAmount)
	if billDiscount > lineNetTotal {
		billDiscount = lineNetTotal
	}
	discountRemaining := billDiscount
	eligibleRemaining := 0
	for _, item := range items {
		if roundMoney(item.LineTotal-item.TaxAmount) > 0 {
			eligibleRemaining++
		}
	}

	var inventoryAccount *ChartAccount
	lines := make([]JournalEntryLineRequest, 0, len(items))
	for _, item := range items {
		lineNet := roundMoney(item.LineTotal - item.TaxAmount)
		if lineNet <= 0 {
			continue
		}
		allocatedDiscount := 0.0
		if billDiscount > 0 && lineNetTotal > 0 {
			if eligibleRemaining == 1 {
				allocatedDiscount = discountRemaining
			} else {
				allocatedDiscount = roundMoney(billDiscount * lineNet / lineNetTotal)
			}
			discountRemaining = roundMoney(discountRemaining - allocatedDiscount)
			eligibleRemaining--
		}
		amount := roundMoney(lineNet - allocatedDiscount)
		if amount <= 0 {
			continue
		}

		lineType := normalizedPurchaseInvoiceAccountingLineType(item)
		accountID := ""
		description := ""
		if lineType == "account" {
			if item.AccountID == nil || strings.TrimSpace(*item.AccountID) == "" {
				return nil, apperrors.BadRequest("purchase invoice account line is missing account_id", map[string]interface{}{"purchase_invoice_item_id": item.ID})
			}
			account, err := s.repo.ValidateActiveAccount(tx, businessID, *item.AccountID)
			if err != nil {
				return nil, apperrors.BadRequest("purchase invoice account line account is inactive or missing", map[string]interface{}{"purchase_invoice_item_id": item.ID})
			}
			accountID = account.ID
			description = "Purchase invoice account line"
			if strings.TrimSpace(item.AccountNameSnapshot) != "" {
				description += " - " + strings.TrimSpace(item.AccountNameSnapshot)
			}
		} else {
			if inventoryAccount == nil {
				inventoryAccount, err = s.requiredMappedAccount(tx, businessID, "inventory_stock", "1200", "Inventory / Stock")
				if err != nil {
					return nil, err
				}
			}
			accountID = inventoryAccount.ID
			description = "Purchase invoice stock value"
		}

		line := JournalEntryLineRequest{AccountID: accountID, Description: description}
		if reverse {
			line.CreditAmount = amount
		} else {
			line.DebitAmount = amount
		}
		lines = append(lines, line)
	}
	return lines, nil
}

func normalizedPurchaseInvoiceAccountingLineType(item purchaseInvoiceItemAccountingRow) string {
	if strings.TrimSpace(item.LineType) == "account" || strings.TrimSpace(item.ItemType) == "account" || item.AccountID != nil {
		return "account"
	}
	return "product"
}

func (s *Service) PostPurchaseInvoicePaymentJournal(tx *gorm.DB, currentUser *utils.AuthContext, paymentID string) (string, error) {
	payment, err := s.repo.FindPurchaseInvoicePaymentForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(paymentID))
	if err != nil {
		return "", apperrors.Internal("failed to load supplier payment for accounting")
	}
	if payment.JournalEntryID != nil && *payment.JournalEntryID != "" {
		return *payment.JournalEntryID, nil
	}
	if payment.PaymentStatus != "completed" {
		return "", nil
	}
	amount := roundMoney(payment.Amount)
	if amount <= 0 {
		return "", nil
	}
	if payment.DefaultPaymentAccountID == nil || strings.TrimSpace(payment.ChartAccountID) == "" {
		return "", apperrors.BadRequest("payment method is not linked to an active payment account", map[string]interface{}{"payment_method": payment.PaymentMethodNameSnapshot})
	}
	if err := validatePaymentAccountBranch(payment.PaymentAccountBranchID, payment.BranchID, payment.PaymentAccountName); err != nil {
		return "", err
	}
	accountsPayable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_payable", "2000", "Accounts Payable")
	if err != nil {
		return "", err
	}
	lines := []JournalEntryLineRequest{
		{AccountID: accountsPayable.ID, DebitAmount: amount, Description: "Supplier payment for " + payment.InvoiceNumber},
		{AccountID: payment.ChartAccountID, CreditAmount: amount, Description: "Supplier payment via " + payment.PaymentMethodNameSnapshot},
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, payment.PaidAt, &payment.BranchID, "purchase_invoice_payment", payment.ID, payment.InvoiceNumber, "Supplier payment "+payment.InvoiceNumber, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePurchaseInvoicePaymentJournalID(tx, currentUser.BusinessID, payment.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update supplier payment accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostSupplierPaymentJournal(tx *gorm.DB, currentUser *utils.AuthContext, paymentID string) (string, error) {
	payment, err := s.repo.FindSupplierPaymentForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(paymentID))
	if err != nil {
		return "", apperrors.Internal("failed to load supplier payment for accounting")
	}
	if payment.JournalEntryID != nil && *payment.JournalEntryID != "" {
		return *payment.JournalEntryID, nil
	}
	if payment.Status != "completed" {
		return "", nil
	}
	amount := roundMoney(payment.Amount)
	allocatedAmount := roundMoney(payment.AllocatedAmount)
	unappliedAmount := roundMoney(payment.UnappliedAmount)
	if amount <= 0 {
		return "", nil
	}
	if strings.TrimSpace(payment.ChartAccountID) == "" {
		return "", apperrors.BadRequest("paid-through account is not linked to an active chart account", map[string]interface{}{"payment_account": payment.PaymentAccountName})
	}
	if err := validatePaymentAccountBranch(payment.PaymentAccountBranchID, payment.BranchID, payment.PaymentAccountName); err != nil {
		return "", err
	}
	accountsPayable, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "accounts_payable", "2000", "Accounts Payable")
	if err != nil {
		return "", err
	}
	lines := make([]JournalEntryLineRequest, 0, 3)
	if allocatedAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: accountsPayable.ID, DebitAmount: allocatedAmount, Description: "Supplier payment applied to bills"})
	}
	if unappliedAmount > 0 {
		supplierAdvance, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "supplier_advance", "1400", "Supplier Advances / Vendor Prepayments")
		if err != nil {
			return "", err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: supplierAdvance.ID, DebitAmount: unappliedAmount, Description: "Unapplied supplier advance"})
	}
	lines = append(lines, JournalEntryLineRequest{AccountID: payment.ChartAccountID, CreditAmount: amount, Description: "Supplier payment via " + payment.PaymentMethodName})
	reference := strings.TrimSpace(payment.ReferenceNumber)
	if reference == "" {
		reference = payment.ID
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, payment.PaymentDate, &payment.BranchID, "supplier_payment", payment.ID, reference, "Supplier payment "+payment.SupplierName, lines)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdateSupplierPaymentJournalID(tx, currentUser.BusinessID, payment.ID, journalID); err != nil {
		return "", apperrors.Internal("failed to update supplier payment accounting journal")
	}
	return journalID, nil
}

func (s *Service) PostPurchaseReceiptJournal(tx *gorm.DB, currentUser *utils.AuthContext, receiptID string) (string, error) {
	// Bill-only purchasing policy: GRN/receive goods is operational stock tracking only.
	// Supplier liability is recognized when the purchase bill is posted.
	_ = tx
	_ = currentUser
	_ = receiptID
	return "", nil
}

func (s *Service) PostInventoryMovementJournal(tx *gorm.DB, currentUser *utils.AuthContext, movementID string) (string, error) {
	movement, err := s.repo.FindStockMovementForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(movementID))
	if err != nil {
		return "", apperrors.Internal("failed to load stock movement for accounting")
	}
	if movement.AccountingJournalEntryID != nil && strings.TrimSpace(*movement.AccountingJournalEntryID) != "" {
		return strings.TrimSpace(*movement.AccountingJournalEntryID), nil
	}
	cost := roundMoney(movement.TotalCost)
	if cost <= 0 {
		return "", nil
	}
	inventoryAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_stock", "1200", "Inventory / Stock")
	if err != nil {
		return "", err
	}
	var lines []JournalEntryLineRequest
	sourceType := "stock_movement"
	if movement.IsReversal && movement.ReversedMovementID != nil && strings.TrimSpace(*movement.ReversedMovementID) != "" {
		lines, sourceType, err = s.buildInventoryMovementReversalLines(tx, currentUser.BusinessID, movement, inventoryAccount)
		if err != nil {
			return "", err
		}
		if len(lines) == 0 {
			return "", nil
		}
		journalID, err := s.createPostedSystemJournal(tx, currentUser, movement.CreatedAt, &movement.BranchID, sourceType, movement.ID, movement.ReferenceNumber, "Inventory movement reversal "+movement.MovementType, lines)
		if err != nil {
			return "", err
		}
		if journalID != "" {
			if err := s.repo.UpdateStockMovementJournalID(tx, currentUser.BusinessID, movement.ID, journalID); err != nil {
				return "", apperrors.Internal("failed to link stock movement accounting journal")
			}
		}
		return journalID, nil
	}
	switch movement.MovementType {
	case "opening_stock":
		openingEquity, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "opening_balance_equity", "3400", "Opening Balance Equity")
		if err != nil {
			return "", err
		}
		lines = []JournalEntryLineRequest{
			{AccountID: inventoryAccount.ID, DebitAmount: cost, Description: "Opening stock value"},
			{AccountID: openingEquity.ID, CreditAmount: cost, Description: "Opening stock equity offset"},
		}
		sourceType = "inventory_opening_stock"
	case "adjustment_in":
		gainAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_adjustment_gain", "4100", "Inventory Adjustment Gain")
		if err != nil {
			return "", err
		}
		lines = []JournalEntryLineRequest{
			{AccountID: inventoryAccount.ID, DebitAmount: cost, Description: "Inventory adjustment increase"},
			{AccountID: gainAccount.ID, CreditAmount: cost, Description: "Inventory adjustment gain"},
		}
		sourceType = "inventory_adjustment"
	case "adjustment_out":
		lossAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_adjustment_loss", "5090", "Inventory Adjustment Loss")
		if err != nil {
			return "", err
		}
		lines = []JournalEntryLineRequest{
			{AccountID: lossAccount.ID, DebitAmount: cost, Description: "Inventory adjustment loss"},
			{AccountID: inventoryAccount.ID, CreditAmount: cost, Description: "Inventory adjustment decrease"},
		}
		sourceType = "inventory_adjustment"
	case "wastage":
		wastageAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "wastage_expense", "5080", "Wastage Expense")
		if err != nil {
			return "", err
		}
		lines = []JournalEntryLineRequest{
			{AccountID: wastageAccount.ID, DebitAmount: cost, Description: "Inventory wastage"},
			{AccountID: inventoryAccount.ID, CreditAmount: cost, Description: "Inventory wastage out"},
		}
		sourceType = "inventory_wastage"
	default:
		return "", nil
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, movement.CreatedAt, &movement.BranchID, sourceType, movement.ID, movement.ReferenceNumber, "Inventory movement "+movement.MovementType, lines)
	if err != nil {
		return "", err
	}
	if journalID != "" {
		if err := s.repo.UpdateStockMovementJournalID(tx, currentUser.BusinessID, movement.ID, journalID); err != nil {
			return "", apperrors.Internal("failed to link stock movement accounting journal")
		}
	}
	return journalID, nil
}

func (s *Service) buildInventoryMovementReversalLines(tx *gorm.DB, businessID string, movement *stockMovementAccountingRow, inventoryAccount *ChartAccount) ([]JournalEntryLineRequest, string, error) {
	original, err := s.repo.FindStockMovementForAccounting(tx, businessID, strings.TrimSpace(*movement.ReversedMovementID))
	if err != nil {
		return nil, "", apperrors.Internal("failed to load original stock movement for accounting reversal")
	}
	cost := roundMoney(movement.TotalCost)
	if cost <= 0 {
		return nil, "", nil
	}
	switch original.MovementType {
	case "opening_stock":
		openingEquity, err := s.requiredMappedAccount(tx, businessID, "opening_balance_equity", "3400", "Opening Balance Equity")
		if err != nil {
			return nil, "", err
		}
		return []JournalEntryLineRequest{
			{AccountID: openingEquity.ID, DebitAmount: cost, Description: "Reverse opening stock equity offset"},
			{AccountID: inventoryAccount.ID, CreditAmount: cost, Description: "Reverse opening stock value"},
		}, "inventory_opening_stock_reversal", nil
	case "adjustment_in":
		gainAccount, err := s.requiredMappedAccount(tx, businessID, "inventory_adjustment_gain", "4100", "Inventory Adjustment Gain")
		if err != nil {
			return nil, "", err
		}
		return []JournalEntryLineRequest{
			{AccountID: gainAccount.ID, DebitAmount: cost, Description: "Reverse inventory adjustment gain"},
			{AccountID: inventoryAccount.ID, CreditAmount: cost, Description: "Reverse inventory adjustment increase"},
		}, "inventory_adjustment_reversal", nil
	case "adjustment_out":
		lossAccount, err := s.requiredMappedAccount(tx, businessID, "inventory_adjustment_loss", "5090", "Inventory Adjustment Loss")
		if err != nil {
			return nil, "", err
		}
		return []JournalEntryLineRequest{
			{AccountID: inventoryAccount.ID, DebitAmount: cost, Description: "Reverse inventory adjustment decrease"},
			{AccountID: lossAccount.ID, CreditAmount: cost, Description: "Reverse inventory adjustment loss"},
		}, "inventory_adjustment_reversal", nil
	case "wastage":
		wastageAccount, err := s.requiredMappedAccount(tx, businessID, "wastage_expense", "5080", "Wastage Expense")
		if err != nil {
			return nil, "", err
		}
		return []JournalEntryLineRequest{
			{AccountID: inventoryAccount.ID, DebitAmount: cost, Description: "Reverse inventory wastage out"},
			{AccountID: wastageAccount.ID, CreditAmount: cost, Description: "Reverse inventory wastage"},
		}, "inventory_wastage_reversal", nil
	default:
		return nil, "", nil
	}
}

func (s *Service) PostManufacturingBatchJournal(tx *gorm.DB, currentUser *utils.AuthContext, batchID string) (string, error) {
	batch, err := s.repo.FindProductionBatchForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(batchID))
	if err != nil {
		return "", apperrors.Internal("failed to load production batch for accounting")
	}
	if batch.Status != "completed" {
		return "", apperrors.BadRequest("only completed production batches can post accounting journals", nil)
	}
	consumptionCost, err := s.repo.SumStockMovementCostByReferenceAndType(tx, currentUser.BusinessID, "production_batch", batch.ID, "production_out")
	if err != nil {
		return "", apperrors.Internal("failed to calculate production consumption cost")
	}
	outputCost, err := s.repo.SumStockMovementCostByReferenceAndType(tx, currentUser.BusinessID, "production_batch", batch.ID, "production_in")
	if err != nil {
		return "", apperrors.Internal("failed to calculate production output cost")
	}
	wastageCost, err := s.repo.SumStockMovementCostByReferenceAndType(tx, currentUser.BusinessID, "production_batch", batch.ID, "wastage")
	if err != nil {
		return "", apperrors.Internal("failed to calculate production wastage cost")
	}
	consumptionCost = roundMoney(consumptionCost)
	outputCost = roundMoney(outputCost)
	wastageCost = roundMoney(wastageCost)
	if consumptionCost <= 0 && outputCost <= 0 && wastageCost <= 0 {
		return "", nil
	}
	inventoryAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "inventory_stock", "1200", "Inventory / Stock")
	if err != nil {
		return "", err
	}
	wipAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "wip_inventory", "1210", "Work in Process Inventory")
	if err != nil {
		return "", err
	}
	lines := make([]JournalEntryLineRequest, 0, 6)
	if consumptionCost > 0 {
		lines = append(lines,
			JournalEntryLineRequest{AccountID: wipAccount.ID, DebitAmount: consumptionCost, Description: "Production ingredient/packaging consumption"},
			JournalEntryLineRequest{AccountID: inventoryAccount.ID, CreditAmount: consumptionCost, Description: "Inventory consumed for production"},
		)
	}
	if outputCost > 0 {
		lines = append(lines,
			JournalEntryLineRequest{AccountID: inventoryAccount.ID, DebitAmount: outputCost, Description: "Finished goods received from production"},
			JournalEntryLineRequest{AccountID: wipAccount.ID, CreditAmount: outputCost, Description: "WIP transferred to finished goods"},
		)
	}
	if wastageCost > 0 {
		wastageAccount, err := s.requiredMappedAccount(tx, currentUser.BusinessID, "wastage_expense", "5080", "Wastage Expense")
		if err != nil {
			return "", err
		}
		lines = append(lines,
			JournalEntryLineRequest{AccountID: wastageAccount.ID, DebitAmount: wastageCost, Description: "Production wastage"},
			JournalEntryLineRequest{AccountID: inventoryAccount.ID, CreditAmount: wastageCost, Description: "Inventory wasted during production"},
		)
	}
	entryDate := time.Now().UTC()
	if batch.CompletedAt != nil {
		entryDate = *batch.CompletedAt
	}
	journalID, err := s.createPostedSystemJournal(tx, currentUser, entryDate, &batch.BranchID, "manufacturing_batch", batch.ID, batch.ProductionBatchNumber, "Manufacturing batch "+batch.ProductionBatchNumber, lines)
	if err != nil {
		return "", err
	}
	if journalID != "" {
		if err := s.repo.UpdateStockMovementJournalByReference(tx, currentUser.BusinessID, "production_batch", batch.ID, "out", journalID); err != nil {
			return "", apperrors.Internal("failed to link production stock movements to accounting journal")
		}
		if err := s.repo.UpdateStockMovementJournalByReference(tx, currentUser.BusinessID, "production_batch", batch.ID, "in", journalID); err != nil {
			return "", apperrors.Internal("failed to link production stock movements to accounting journal")
		}
	}
	return journalID, nil
}

func (s *Service) PostExpenseJournal(tx *gorm.DB, currentUser *utils.AuthContext, expenseID string) (string, error) {
	expense, err := s.repo.FindExpenseForAccounting(tx, currentUser.BusinessID, strings.TrimSpace(expenseID))
	if err != nil {
		return "", apperrors.Internal("failed to load expense for accounting")
	}
	if expense.JournalEntryID != nil && strings.TrimSpace(*expense.JournalEntryID) != "" {
		return strings.TrimSpace(*expense.JournalEntryID), nil
	}
	if expense.Status != "posted" {
		return "", nil
	}
	amount := roundMoney(expense.Amount)
	if amount <= 0 {
		return "", nil
	}
	lines := []JournalEntryLineRequest{
		{AccountID: expense.ExpenseAccountID, DebitAmount: amount, Description: coalesceText(expense.Notes, "Expense "+expense.ExpenseNumber)},
		{AccountID: expense.PaidThroughAccountID, CreditAmount: amount, Description: "Paid through account"},
	}
	reference := coalesceText(expense.ReferenceNumber, expense.ExpenseNumber)
	journalID, err := s.createPostedSystemJournal(tx, currentUser, expense.ExpenseDate, &expense.BranchID, "expense", expense.ID, reference, "Expense "+expense.ExpenseNumber, lines)
	if err != nil {
		return "", err
	}
	if journalID != "" {
		if err := s.repo.UpdateExpenseJournalID(tx, currentUser.BusinessID, expense.ID, journalID); err != nil {
			return "", apperrors.Internal("failed to update expense accounting journal")
		}
	}
	return journalID, nil
}

func (s *Service) BackfillJournals(currentUser *utils.AuthContext, req BackfillJournalsRequest, ipAddress, userAgent string) (*BackfillJournalsResponse, error) {
	req = normalizeBackfillRequest(req)
	if err := s.validateBackfillRequest(currentUser, req); err != nil {
		return nil, err
	}

	startedAt := time.Now().UTC()
	results := make([]BackfillTargetResult, 0, len(req.Targets))
	for _, target := range req.Targets {
		result := BackfillTargetResult{Target: target}
		ids, err := s.repo.ListBackfillCandidateIDs(s.db, currentUser.BusinessID, target, req)
		if err != nil {
			result.Failed = 1
			result.Errors = append(result.Errors, err.Error())
			results = append(results, result)
			continue
		}
		result.Scanned = len(ids)
		result.WouldPost = len(ids)
		if req.DryRun {
			result.Skipped = len(ids)
			results = append(results, result)
			continue
		}
		for _, id := range ids {
			posted, err := s.backfillOneJournal(currentUser, target, id)
			if err != nil {
				result.Failed++
				if len(result.Errors) < 20 {
					result.Errors = append(result.Errors, id+": "+err.Error())
				}
				continue
			}
			if posted {
				result.Posted++
			} else {
				result.Skipped++
			}
		}
		results = append(results, result)
	}
	endedAt := time.Now().UTC()

	if !req.DryRun {
		_ = s.withTransaction(func(tx *gorm.DB) error {
			return s.writeAudit(tx, currentUser, "accounting.backfill_journals_run", currentUser.BusinessID, "Accounting journal backfill executed.", ipAddress, userAgent)
		})
	}

	return &BackfillJournalsResponse{
		DryRun:    req.DryRun,
		DateFrom:  req.DateFrom,
		DateTo:    req.DateTo,
		BranchID:  req.BranchID,
		Limit:     req.Limit,
		Results:   results,
		StartedAt: startedAt,
		EndedAt:   endedAt,
	}, nil
}

func (s *Service) GetBackfillReadiness(currentUser *utils.AuthContext, query BackfillReadinessQuery, ipAddress, userAgent string) (*BackfillReadinessResponse, error) {
	req := normalizeBackfillRequest(BackfillJournalsRequest{
		Targets:  backfillReadinessTargets(query),
		BranchID: query.BranchID,
		DateFrom: query.DateFrom,
		DateTo:   query.DateTo,
		Limit:    0,
		DryRun:   true,
	})
	req.Limit = 0
	if err := s.validateBackfillRequest(currentUser, req); err != nil {
		return nil, err
	}

	issues, err := s.accountingSetupReadinessIssues(currentUser.BusinessID)
	if err != nil {
		return nil, err
	}

	missingCostCount, err := s.repo.CountValueMovementsMissingCost(s.db, currentUser.BusinessID, req)
	if err != nil {
		return nil, apperrors.Internal("failed to check inventory valuation costs")
	}
	if missingCostCount > 0 {
		issues = append(issues, BackfillReadinessIssue{
			Severity: "warning",
			CheckKey: "stock_movement_cost_missing",
			Message:  "Some value-affecting stock movements have zero or missing total_cost; COGS/inventory backfill may skip or understate value.",
			Details:  map[string]interface{}{"movement_count": missingCostCount},
		})
	}

	targets := make([]BackfillReadinessTarget, 0, len(req.Targets))
	for _, target := range req.Targets {
		count, err := s.repo.CountBackfillCandidates(s.db, currentUser.BusinessID, target, req)
		if err != nil {
			issues = append(issues, BackfillReadinessIssue{
				Severity: "error",
				CheckKey: "backfill_candidate_scan_failed",
				Message:  "Failed to scan backfill candidates for target.",
				Details:  map[string]interface{}{"target": target, "error": err.Error()},
			})
			continue
		}
		targets = append(targets, BackfillReadinessTarget{Target: target, CandidateCount: count})
	}

	ready := setupIssuesAreReady(issues)
	_ = s.writeReportAudit(currentUser, "accounting.backfill_readiness_viewed", "backfill_readiness", query, ipAddress, userAgent)
	return &BackfillReadinessResponse{
		Ready:     ready,
		BranchID:  req.BranchID,
		DateFrom:  req.DateFrom,
		DateTo:    req.DateTo,
		Targets:   targets,
		Issues:    issues,
		CheckedAt: time.Now().UTC(),
	}, nil
}

func (s *Service) GetAccountingSetupReadiness(currentUser *utils.AuthContext, ipAddress, userAgent string) (*AccountingSetupReadinessResponse, error) {
	issues, err := s.accountingSetupReadinessIssues(currentUser.BusinessID)
	if err != nil {
		return nil, err
	}
	_ = s.writeReportAudit(currentUser, "accounting.setup_readiness_viewed", "setup_readiness", nil, ipAddress, userAgent)
	return &AccountingSetupReadinessResponse{
		Ready:     setupIssuesAreReady(issues),
		Issues:    issues,
		CheckedAt: time.Now().UTC(),
	}, nil
}

func (s *Service) accountingSetupReadinessIssues(businessID string) ([]BackfillReadinessIssue, error) {
	issues := make([]BackfillReadinessIssue, 0)
	missingMappings, err := s.repo.ListMissingRequiredAccountMappings(s.db, businessID, backfillRequiredMappingKeys())
	if err != nil {
		return nil, apperrors.Internal("failed to check account mappings")
	}
	for _, mappingKey := range missingMappings {
		issues = append(issues, BackfillReadinessIssue{
			Severity: "error",
			CheckKey: "account_mapping_missing",
			Message:  "Required account mapping is missing or linked to an inactive chart account.",
			Details: map[string]interface{}{
				"mapping_key": mappingKey,
				"description": defaultAccountMappingDescription(mappingKey),
			},
		})
	}

	paymentIssues, err := s.repo.ListPaymentMethodReadinessIssues(s.db, businessID)
	if err != nil {
		return nil, apperrors.Internal("failed to check payment method setup")
	}
	issues = append(issues, paymentIssues...)

	return issues, nil
}

func setupIssuesAreReady(issues []BackfillReadinessIssue) bool {
	for _, issue := range issues {
		if readinessSeverityBlocks(issue.Severity) {
			return false
		}
	}
	return true
}

func readinessSeverityBlocks(severity string) bool {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "error", "blocking":
		return true
	default:
		return false
	}
}

func (s *Service) GetPurchasingPostingIntegrity(currentUser *utils.AuthContext, ipAddress, userAgent string) (*PurchasingPostingIntegrityResponse, error) {
	issues := make([]PurchasingPostingIntegrityIssue, 0)
	checks := []struct {
		key     string
		message string
		count   func(string) (int64, error)
		details map[string]interface{}
	}{
		{
			key:     "legacy_purchase_receipt_grni_unreversed",
			message: "Legacy purchase receipt GRNI journals are still posted. Run the bill-only GRNI reversal migration or repair before trusting liability reports.",
			count:   s.repo.CountUnreversedPurchaseReceiptGRNIJournals,
			details: map[string]interface{}{"expected_fix": "migration_000077_bill_only_purchase_receipt_grni_reversal"},
		},
		{
			key:     "purchase_receipt_stock_movement_has_accounting_journal",
			message: "Purchase receipt stock movements still have accounting journal links. GRN should update stock only under bill-only purchasing accounting.",
			count:   s.repo.CountPurchaseReceiptMovementsWithAccountingJournal,
		},
		{
			key:     "posted_receipt_item_missing_stock_movement",
			message: "Posted receipt items without stock movement links were found. Stock quantity may not match received goods history.",
			count:   s.repo.CountPostedReceiptItemsMissingStockMovement,
		},
		{
			key:     "duplicate_receipt_item_stock_movement_link",
			message: "Multiple posted receipt items are linked to the same stock movement. Receipt stock history should be one movement per posted receipt item.",
			count:   s.repo.CountDuplicateLinkedReceiptStockMovements,
		},
		{
			key:     "duplicate_active_receipts_for_purchase_bill",
			message: "A purchase bill has more than one active stock receipt. This can duplicate received stock for the same bill.",
			count:   s.repo.CountDuplicateActiveReceiptsForInvoice,
		},
		{
			key:     "posted_purchase_return_missing_journal",
			message: "Posted vendor credits without accounting journals were found. Run purchase return journal backfill before trusting inventory, AP, GL, Trial Balance, or Balance Sheet reports.",
			count:   s.repo.CountPostedPurchaseReturnsMissingJournal,
			details: map[string]interface{}{"backfill_target": "purchase_returns"},
		},
		{
			key:     "purchase_return_stock_movement_missing_accounting_journal",
			message: "Vendor credit stock movements without accounting journal links were found. Re-run purchase return journal backfill to reconnect inventory movement history to accounting.",
			count:   s.repo.CountPurchaseReturnMovementsMissingAccountingJournal,
			details: map[string]interface{}{"backfill_target": "purchase_returns"},
		},
	}

	for _, check := range checks {
		count, err := check.count(currentUser.BusinessID)
		if err != nil {
			return nil, apperrors.Internal("failed to check purchasing posting integrity")
		}
		if count == 0 {
			continue
		}
		issue := PurchasingPostingIntegrityIssue{
			CheckKey: check.key,
			Severity: "error",
			Message:  check.message,
			Count:    count,
			Details:  check.details,
		}
		issues = append(issues, issue)
	}

	_ = s.writeReportAudit(currentUser, "accounting.purchasing_posting_integrity_viewed", "purchasing_posting_integrity", nil, ipAddress, userAgent)
	return &PurchasingPostingIntegrityResponse{
		Healthy:   len(issues) == 0,
		Policy:    "bill_only_purchasing_accounting",
		Issues:    issues,
		CheckedAt: time.Now().UTC(),
	}, nil
}

func (s *Service) backfillOneJournal(currentUser *utils.AuthContext, target, id string) (bool, error) {
	var journalID string
	err := s.withTransaction(func(tx *gorm.DB) error {
		var err error
		switch target {
		case "pos_sales":
			journalID, err = s.PostPOSSaleJournal(tx, currentUser, id)
			if err != nil {
				return err
			}
			cogsJournalID, cogsErr := s.PostPOSSaleCOGSJournal(tx, currentUser, id)
			if cogsErr != nil {
				return cogsErr
			}
			if journalID == "" {
				journalID = cogsJournalID
			}
		case "bakery_orders":
			journalID, err = s.PostBakeryOrderRevenueJournal(tx, currentUser, id)
		case "bakery_order_payments":
			journalID, err = s.PostBakeryOrderPaymentJournal(tx, currentUser, id)
		case "payment_refunds":
			journalID, err = s.PostPOSPaymentRefundJournal(tx, currentUser, id)
		case "purchase_invoices":
			journalID, err = s.PostPurchaseInvoiceJournal(tx, currentUser, id)
		case "purchase_invoice_payments":
			journalID, err = s.PostPurchaseInvoicePaymentJournal(tx, currentUser, id)
		case "supplier_payments":
			journalID, err = s.PostSupplierPaymentJournal(tx, currentUser, id)
		case "stock_movements":
			journalID, err = s.PostInventoryMovementJournal(tx, currentUser, id)
		case "manufacturing_batches":
			journalID, err = s.PostManufacturingBatchJournal(tx, currentUser, id)
		case "sales_returns":
			journalID, err = s.PostSalesReturnJournal(tx, currentUser, id)
			if err != nil {
				return err
			}
			inventoryJournalID, inventoryErr := s.PostSalesReturnInventoryJournal(tx, currentUser, id)
			if inventoryErr != nil {
				return inventoryErr
			}
			if journalID == "" {
				journalID = inventoryJournalID
			}
		case "purchase_returns":
			journalID, err = s.PostPurchaseReturnJournal(tx, currentUser, id)
		case "expenses":
			journalID, err = s.PostExpenseJournal(tx, currentUser, id)
		default:
			err = apperrors.BadRequest("unsupported backfill target", map[string]string{"target": target})
		}
		return err
	})
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(journalID) != "", nil
}

func (s *Service) ListJournalEntries(currentUser *utils.AuthContext, query JournalEntryListQuery) (*PaginatedResponse[JournalEntryResponse], error) {
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	query.JournalOrigin = strings.ToLower(strings.TrimSpace(query.JournalOrigin))
	if query.JournalOrigin == "all" {
		query.JournalOrigin = ""
	}
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
	isAccountLedger := query.AccountID != ""
	ledgerMode := "combined"
	if isAccountLedger {
		ledgerMode = "account"
	}
	var account *GeneralLedgerAccountResponse
	if isAccountLedger {
		found, err := s.repo.FindAccountForReport(currentUser.BusinessID, query.AccountID)
		if err != nil {
			return nil, mapChartAccountNotFound(err)
		}
		account = found
	}
	openingBalance := 0.0
	if isAccountLedger {
		var err error
		openingBalance, err = s.repo.GeneralLedgerOpeningBalance(currentUser.BusinessID, query)
		if err != nil {
			return nil, apperrors.Internal("failed to calculate ledger opening balance")
		}
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
	closingBalance := 0.0
	if isAccountLedger {
		closingBalance = roundMoney(openingBalance + periodDebit - periodCredit)
	}
	_ = s.writeReportAudit(currentUser, "accounting.general_ledger_viewed", "general_ledger", query, ipAddress, userAgent)
	return &GeneralLedgerResponse{
		Account:            account,
		LedgerMode:         ledgerMode,
		ShowRunningBalance: isAccountLedger,
		OpeningBalance:     openingBalance,
		PeriodDebit:        periodDebit,
		PeriodCredit:       periodCredit,
		ClosingBalance:     closingBalance,
		Items:              rows,
		Pagination:         PaginationResponse{Page: query.Page, Limit: query.Limit, Total: total, TotalPages: totalPages(total, query.Limit)},
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
	currentYearProfitLoss, financialYearStartDate, err := s.currentYearProfitLossForBalanceSheet(currentUser.BusinessID, query)
	if err != nil {
		return nil, err
	}
	if currentYearProfitLoss.Amount != 0 {
		equity.Items = append(equity.Items, currentYearProfitLoss)
		equity.Total = roundMoney(equity.Total + currentYearProfitLoss.Amount)
	}
	totalLiabilitiesAndEquity := roundMoney(liabilities.Total + equity.Total)
	difference := roundMoney(assets.Total - totalLiabilitiesAndEquity)
	_ = s.writeReportAudit(currentUser, "accounting.balance_sheet_viewed", "balance_sheet", query, ipAddress, userAgent)
	return &BalanceSheetResponse{
		AsOfDate:                  query.AsOfDate,
		FinancialYearStartDate:    financialYearStartDate,
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

func (s *Service) GetReconciliationHealth(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (*ReconciliationHealthResponse, error) {
	query = normalizeReconciliationQuery(query)
	if err := s.validateReconciliationQuery(currentUser, query); err != nil {
		return nil, err
	}
	trialBalance, err := s.reconcileTrialBalance(currentUser, query)
	if err != nil {
		return nil, err
	}
	balanceSheet, err := s.reconcileBalanceSheet(currentUser, query, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	checks := make([]ReconciliationCheckResponse, 0, 3)
	inventoryCheck, err := s.GetInventoryReconciliation(currentUser, query, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	checks = append(checks, *inventoryCheck)
	apCheck, err := s.GetAPReconciliation(currentUser, query, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	checks = append(checks, *apCheck)
	arCheck, err := s.GetARReconciliation(currentUser, query, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}
	checks = append(checks, *arCheck)
	unmatched := 0
	if !trialBalance.IsMatched {
		unmatched++
	}
	if !balanceSheet.IsMatched {
		unmatched++
	}
	for _, check := range checks {
		if !check.IsMatched {
			unmatched++
		}
	}
	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_health_viewed", "reconciliation_health", query, ipAddress, userAgent)
	return &ReconciliationHealthResponse{
		AsOfDate:        query.AsOfDate,
		BranchID:        query.BranchID,
		IsHealthy:       unmatched == 0,
		TrialBalance:    trialBalance,
		BalanceSheet:    balanceSheet,
		Checks:          checks,
		UnmatchedChecks: unmatched,
	}, nil
}

func (s *Service) GetInventoryReconciliation(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (*ReconciliationCheckResponse, error) {
	query = normalizeReconciliationQuery(query)
	if err := s.validateReconciliationQuery(currentUser, query); err != nil {
		return nil, err
	}
	operational, err := s.repo.SumInventoryOperationalValue(currentUser.BusinessID, query.BranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate operational inventory value")
	}
	ledger, err := s.mappedLedgerBalance(currentUser.BusinessID, "inventory_stock", "1200", query.BranchID, query.AsOfDate)
	if err != nil {
		return nil, err
	}
	check := reconciliationCheck("inventory", "Inventory valuation vs Inventory ledger", operational, ledger, "Compares inventory_items.inventory_value with the mapped Inventory / Stock ledger.")
	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_inventory_viewed", "reconciliation_inventory", query, ipAddress, userAgent)
	return &check, nil
}

func (s *Service) GetInventoryReconciliationDetails(currentUser *utils.AuthContext, query InventoryReconciliationDetailsQuery, ipAddress, userAgent string) (*InventoryReconciliationDetailsResponse, error) {
	query = normalizeInventoryReconciliationDetailsQuery(query)
	if err := s.validateInventoryReconciliationDetailsQuery(currentUser, query); err != nil {
		return nil, err
	}
	inventoryAccount, err := s.requiredMappedAccount(s.db, currentUser.BusinessID, "inventory_stock", "1200", defaultAccountMappingDescription("inventory_stock"))
	if err != nil {
		return nil, err
	}
	rawRows, err := s.repo.ListInventoryReconciliationDetailRows(currentUser.BusinessID, inventoryAccount.ID, query)
	if err != nil {
		return nil, apperrors.Internal("failed to load inventory reconciliation details")
	}

	items := make([]InventoryReconciliationDetailItem, 0, len(rawRows))
	var allMatchedCount int64
	var allMismatchCount int64
	for _, row := range rawRows {
		item := inventoryReconciliationDetailFromRow(row)
		if item.Status == "matched" {
			allMatchedCount++
		} else {
			allMismatchCount++
		}
		if query.Status != "" && item.Status != query.Status {
			continue
		}
		items = append(items, item)
	}
	sortInventoryReconciliationDetails(items, query.SortBy, query.SortOrder)

	total := int64(len(items))
	totalOperational := 0.0
	totalLedger := 0.0
	totalAccounting := 0.0
	for _, item := range items {
		totalOperational = roundMoney(totalOperational + item.OperationalInventoryValue)
		totalLedger = roundMoney(totalLedger + item.InventoryLedgerValue)
		totalAccounting = roundMoney(totalAccounting + item.AccountingInventoryValue)
	}
	pagedItems := paginateInventoryReconciliationDetails(items, query.Page, query.Limit)
	glBalance, err := s.repo.LedgerBalanceForAccount(currentUser.BusinessID, inventoryAccount.ID, inventoryAccount.NormalBalance, query.BranchID, query.AsOfDate)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate inventory ledger balance")
	}

	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_inventory_details_viewed", "reconciliation_inventory_details", query, ipAddress, userAgent)
	return &InventoryReconciliationDetailsResponse{
		AsOfDate:                       query.AsOfDate,
		BranchID:                       query.BranchID,
		TotalOperationalValue:          roundMoney(totalOperational),
		TotalInventoryLedgerValue:      roundMoney(totalLedger),
		TotalAccountingInventoryValue:  roundMoney(totalAccounting),
		GeneralLedgerInventoryBalance:  roundMoney(glBalance),
		UnassignedAccountingDifference: roundMoney(glBalance - totalAccounting),
		MatchedCount:                   allMatchedCount,
		MismatchCount:                  allMismatchCount,
		Items:                          pagedItems,
		Pagination: PaginationResponse{
			Page:       query.Page,
			Limit:      query.Limit,
			Total:      total,
			TotalPages: totalPages(total, query.Limit),
		},
	}, nil
}

func (s *Service) GetAPReconciliation(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (*ReconciliationCheckResponse, error) {
	query = normalizeReconciliationQuery(query)
	if err := s.validateReconciliationQuery(currentUser, query); err != nil {
		return nil, err
	}
	operational, err := s.repo.SumAccountsPayableOperational(currentUser.BusinessID, query.BranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate operational accounts payable")
	}
	ledger, err := s.mappedLedgerBalance(currentUser.BusinessID, "accounts_payable", "2000", query.BranchID, query.AsOfDate)
	if err != nil {
		return nil, err
	}
	check := reconciliationCheck("accounts_payable", "Open supplier invoices vs Accounts Payable ledger", operational, ledger, "Compares posted purchase invoice balances with the mapped Accounts Payable ledger.")
	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_ap_viewed", "reconciliation_ap", query, ipAddress, userAgent)
	return &check, nil
}

func (s *Service) GetARReconciliation(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (*ReconciliationCheckResponse, error) {
	query = normalizeReconciliationQuery(query)
	if err := s.validateReconciliationQuery(currentUser, query); err != nil {
		return nil, err
	}
	operational, err := s.repo.SumAccountsReceivableOperational(currentUser.BusinessID, query.BranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to calculate operational accounts receivable")
	}
	ledger, err := s.mappedLedgerBalance(currentUser.BusinessID, "accounts_receivable", "1100", query.BranchID, query.AsOfDate)
	if err != nil {
		return nil, err
	}
	check := reconciliationCheck("accounts_receivable", "Unpaid customer balances vs Accounts Receivable ledger", operational, ledger, "Compares unpaid completed POS/bakery balances with the mapped Accounts Receivable ledger.")
	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_ar_viewed", "reconciliation_ar", query, ipAddress, userAgent)
	return &check, nil
}

func (s *Service) GetPaymentAccountReconciliation(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (*PaymentAccountReconciliationResponse, error) {
	query = normalizeReconciliationQuery(query)
	if err := s.validateReconciliationQuery(currentUser, query); err != nil {
		return nil, err
	}
	rows, err := s.repo.ListPaymentAccountReconciliationRows(currentUser.BusinessID, query.BranchID)
	if err != nil {
		return nil, apperrors.Internal("failed to load payment account reconciliation")
	}
	for i := range rows {
		account, err := s.repo.FindByID(currentUser.BusinessID, rows[i].ChartAccountID)
		if err != nil {
			return nil, mapChartAccountNotFound(err)
		}
		ledger, err := s.repo.LedgerBalanceForAccount(currentUser.BusinessID, rows[i].ChartAccountID, account.NormalBalance, query.BranchID, query.AsOfDate)
		if err != nil {
			return nil, apperrors.Internal("failed to calculate payment account ledger balance")
		}
		rows[i].LedgerAmount = ledger
	}
	_ = s.writeReportAudit(currentUser, "accounting.reconciliation_payment_accounts_viewed", "reconciliation_payment_accounts", query, ipAddress, userAgent)
	return &PaymentAccountReconciliationResponse{AsOfDate: query.AsOfDate, BranchID: query.BranchID, Items: rows}, nil
}

func (s *Service) reconcileTrialBalance(currentUser *utils.AuthContext, query ReconciliationQuery) (ReconciliationCheckResponse, error) {
	rows, err := s.repo.ListTrialBalanceRows(currentUser.BusinessID, TrialBalanceQuery{
		BranchID:            query.BranchID,
		DateFrom:            "1900-01-01",
		DateTo:              query.AsOfDate,
		IncludeZeroBalances: false,
	})
	if err != nil {
		return ReconciliationCheckResponse{}, apperrors.Internal("failed to calculate trial balance health")
	}
	totalDebit := 0.0
	totalCredit := 0.0
	for _, row := range rows {
		totalDebit = roundMoney(totalDebit + row.ClosingDebit)
		totalCredit = roundMoney(totalCredit + row.ClosingCredit)
	}
	return reconciliationCheck("trial_balance", "Trial Balance debit vs credit", totalDebit, totalCredit, "Checks whether posted journal debit and credit balances are equal."), nil
}

func (s *Service) reconcileBalanceSheet(currentUser *utils.AuthContext, query ReconciliationQuery, ipAddress, userAgent string) (ReconciliationCheckResponse, error) {
	balanceSheet, err := s.GetBalanceSheet(currentUser, BalanceSheetQuery{BranchID: query.BranchID, AsOfDate: query.AsOfDate}, ipAddress, userAgent)
	if err != nil {
		return ReconciliationCheckResponse{}, err
	}
	return reconciliationCheck("balance_sheet", "Assets vs Liabilities + Equity", balanceSheet.TotalAssets, balanceSheet.TotalLiabilitiesAndEquity, "Checks whether Balance Sheet totals match after calculated current-year profit/loss."), nil
}

func (s *Service) mappedLedgerBalance(businessID, mappingKey, fallbackCode, branchID, asOfDate string) (float64, error) {
	account, err := s.requiredMappedAccount(s.db, businessID, mappingKey, fallbackCode, defaultAccountMappingDescription(mappingKey))
	if err != nil {
		return 0, err
	}
	ledger, err := s.repo.LedgerBalanceForAccount(businessID, account.ID, account.NormalBalance, branchID, asOfDate)
	if err != nil {
		return 0, apperrors.Internal("failed to calculate mapped ledger balance")
	}
	return ledger, nil
}

func (s *Service) currentYearProfitLossForBalanceSheet(businessID string, query BalanceSheetQuery) (BalanceSheetAccountRowResponse, string, error) {
	asOfDate, err := time.Parse("2006-01-02", strings.TrimSpace(query.AsOfDate))
	if err != nil {
		return BalanceSheetAccountRowResponse{}, "", apperrors.BadRequest("as_of_date must be YYYY-MM-DD", nil)
	}
	settings, err := s.repo.EnsureAccountingSettings(s.db, businessID)
	if err != nil {
		return BalanceSheetAccountRowResponse{}, "", apperrors.Internal("failed to load accounting settings")
	}
	financialYearStart := financialYearStartFor(asOfDate, settings.FinancialYearStartMonth, settings.FinancialYearStartDay)
	dateFrom := financialYearStart.Format("2006-01-02")
	rows, err := s.repo.ListProfitLossRows(businessID, ProfitLossQuery{
		BranchID: query.BranchID,
		DateFrom: dateFrom,
		DateTo:   query.AsOfDate,
	})
	if err != nil {
		return BalanceSheetAccountRowResponse{}, "", apperrors.Internal("failed to calculate current year profit/loss")
	}
	netProfit := 0.0
	for _, row := range rows {
		switch row.AccountType {
		case "income":
			netProfit = roundMoney(netProfit + row.Amount)
		case "cogs", "expense":
			netProfit = roundMoney(netProfit - row.Amount)
		}
	}
	if netProfit == 0 {
		return BalanceSheetAccountRowResponse{}, dateFrom, nil
	}
	account, err := s.repo.FindActiveAccountByCode(s.db, businessID, "3200")
	if err != nil && err != gorm.ErrRecordNotFound {
		return BalanceSheetAccountRowResponse{}, "", apperrors.Internal("failed to load current year profit/loss account")
	}
	row := BalanceSheetAccountRowResponse{
		AccountCode:  "3200",
		AccountName:  "Current Year Profit / Loss",
		AccountType:  "equity",
		AccountGroup: "equity",
		Amount:       roundMoney(netProfit),
		IsCalculated: true,
	}
	if err == nil {
		row.AccountID = account.ID
		row.AccountCode = account.AccountCode
		row.AccountName = account.AccountName
		row.AccountType = account.AccountType
		row.AccountGroup = account.AccountGroup
	}
	return row, dateFrom, nil
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

func (s *Service) DeleteJournalEntry(currentUser *utils.AuthContext, id, ipAddress, userAgent string) error {
	return s.withTransaction(func(tx *gorm.DB) error {
		entry, err := s.repo.FindJournalEntryForUpdate(tx, currentUser.BusinessID, id)
		if err != nil {
			return mapJournalEntryNotFound(err)
		}
		if entry.BranchID != nil && *entry.BranchID != "" && !currentUser.CanAccessBranch(*entry.BranchID) {
			return apperrors.Forbidden("branch access denied")
		}
		if strings.TrimSpace(entry.SourceType) != "" {
			return apperrors.BadRequest("system-generated journal entries must be deleted from the source document", nil)
		}
		if entry.ReversedEntryID != nil {
			return apperrors.BadRequest("reversal journal entries cannot be hard deleted individually", nil)
		}
		reversalCount, err := s.repo.CountJournalReversalLinks(tx, currentUser.BusinessID, entry.ID)
		if err != nil {
			return apperrors.Internal("failed to validate journal reversal links")
		}
		if reversalCount > 0 {
			return apperrors.BadRequest("journal entry has reversal links and cannot be hard deleted", nil)
		}
		if err := s.repo.HardDeleteJournalEntry(tx, currentUser.BusinessID, entry.ID); err != nil {
			return mapJournalEntryNotFound(err)
		}
		return s.writeAudit(tx, currentUser, "accounting.journal_entry_hard_deleted", entry.ID, "Journal entry hard deleted.", ipAddress, userAgent)
	})
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

func (s *Service) validatePaymentAccountFilters(currentUser *utils.AuthContext, query PaymentAccountListQuery) error {
	if query.BranchID != "" {
		if _, err := uuid.Parse(query.BranchID); err != nil {
			return apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := s.validateJournalBranch(s.db, currentUser, &query.BranchID); err != nil {
			return err
		}
	}
	if query.AccountType != "" && !validPaymentAccountType(query.AccountType) {
		return apperrors.BadRequest("invalid account_type", nil)
	}
	if query.Status != "" && !validAccountStatus(query.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	if query.SortOrder != "asc" && query.SortOrder != "desc" {
		return apperrors.BadRequest("sort_order must be asc or desc", nil)
	}
	return nil
}

func (s *Service) validateAccountTransferFilters(currentUser *utils.AuthContext, query AccountTransferListQuery) error {
	if query.BranchID != "" {
		if _, err := uuid.Parse(query.BranchID); err != nil {
			return apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := s.validateJournalBranch(s.db, currentUser, &query.BranchID); err != nil {
			return err
		}
	}
	if query.PaymentAccountID != "" {
		if _, err := uuid.Parse(query.PaymentAccountID); err != nil {
			return apperrors.BadRequest("payment_account_id must be a valid UUID", nil)
		}
	}
	if err := validateOptionalDateRange(query.DateFrom, query.DateTo); err != nil {
		return err
	}
	if query.SortOrder != "asc" && query.SortOrder != "desc" {
		return apperrors.BadRequest("sort_order must be asc or desc", nil)
	}
	return nil
}

func (s *Service) validatePlatformSettlementFilters(currentUser *utils.AuthContext, query PlatformSettlementListQuery) error {
	if query.BranchID != "" {
		if _, err := uuid.Parse(query.BranchID); err != nil {
			return apperrors.BadRequest("branch_id must be a valid UUID", nil)
		}
		if err := s.validateJournalBranch(s.db, currentUser, &query.BranchID); err != nil {
			return err
		}
	}
	for field, value := range map[string]string{
		"platform_payment_account_id": query.PlatformPaymentAccountID,
		"deposit_payment_account_id":  query.DepositPaymentAccountID,
	} {
		if value == "" {
			continue
		}
		if _, err := uuid.Parse(value); err != nil {
			return apperrors.BadRequest(field+" must be a valid UUID", nil)
		}
	}
	if err := validateOptionalDateRange(query.DateFrom, query.DateTo); err != nil {
		return err
	}
	if query.SortOrder != "asc" && query.SortOrder != "desc" {
		return apperrors.BadRequest("sort_order must be asc or desc", nil)
	}
	return nil
}

func validateJournalEntryFilters(query JournalEntryListQuery) error {
	if query.Status != "" && !validJournalEntryStatus(query.Status) {
		return apperrors.BadRequest("invalid status", nil)
	}
	if query.JournalOrigin != "" && query.JournalOrigin != "manual" && query.JournalOrigin != "system" && query.JournalOrigin != "all" {
		return apperrors.BadRequest("journal_origin must be all, manual, or system", nil)
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

func validateOptionalDateRange(dateFrom, dateTo string) error {
	dateFrom = strings.TrimSpace(dateFrom)
	dateTo = strings.TrimSpace(dateTo)
	if dateFrom != "" {
		if _, err := time.Parse("2006-01-02", dateFrom); err != nil {
			return apperrors.BadRequest("date_from must be YYYY-MM-DD", nil)
		}
	}
	if dateTo != "" {
		if _, err := time.Parse("2006-01-02", dateTo); err != nil {
			return apperrors.BadRequest("date_to must be YYYY-MM-DD", nil)
		}
	}
	if dateFrom != "" && dateTo != "" {
		from, _ := time.Parse("2006-01-02", dateFrom)
		to, _ := time.Parse("2006-01-02", dateTo)
		if from.After(to) {
			return apperrors.BadRequest("date_from cannot be after date_to", nil)
		}
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

func validPaymentAccountType(value string) bool {
	switch value {
	case "cash", "bank", "card_clearing", "platform_clearing", "wallet", "other":
		return true
	default:
		return false
	}
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

func normalizeReconciliationQuery(query ReconciliationQuery) ReconciliationQuery {
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.AsOfDate = strings.TrimSpace(query.AsOfDate)
	if query.AsOfDate == "" {
		query.AsOfDate = time.Now().UTC().Format("2006-01-02")
	}
	return query
}

func normalizeInventoryReconciliationDetailsQuery(query InventoryReconciliationDetailsQuery) InventoryReconciliationDetailsQuery {
	query.BranchID = strings.TrimSpace(query.BranchID)
	query.AsOfDate = strings.TrimSpace(query.AsOfDate)
	query.DateFrom = strings.TrimSpace(query.DateFrom)
	query.DateTo = strings.TrimSpace(query.DateTo)
	query.ItemType = strings.ToLower(strings.TrimSpace(query.ItemType))
	query.Status = strings.ToLower(strings.TrimSpace(query.Status))
	if query.Status == "unmatched" {
		query.Status = "mismatch"
	}
	if query.AsOfDate == "" && query.DateTo != "" {
		query.AsOfDate = query.DateTo
	}
	if query.AsOfDate == "" {
		query.AsOfDate = time.Now().UTC().Format("2006-01-02")
	}
	query.Page, query.Limit = normalizePagination(query.Page, query.Limit)
	query.SortBy = strings.ToLower(strings.TrimSpace(query.SortBy))
	if query.SortBy == "" {
		query.SortBy = "difference_amount"
	}
	query.SortOrder = strings.ToLower(strings.TrimSpace(query.SortOrder))
	if query.SortOrder != "asc" {
		query.SortOrder = "desc"
	}
	return query
}

func (s *Service) validateReconciliationQuery(currentUser *utils.AuthContext, query ReconciliationQuery) error {
	if _, err := parseRequiredDate(query.AsOfDate, "as_of_date"); err != nil {
		return err
	}
	branchID := cleanStringPointer(&query.BranchID)
	return s.validateJournalBranch(s.db, currentUser, branchID)
}

func (s *Service) validateInventoryReconciliationDetailsQuery(currentUser *utils.AuthContext, query InventoryReconciliationDetailsQuery) error {
	asOfDate, err := parseRequiredDate(query.AsOfDate, "as_of_date")
	if err != nil {
		return err
	}
	if query.DateFrom != "" {
		dateFrom, err := parseRequiredDate(query.DateFrom, "date_from")
		if err != nil {
			return err
		}
		if dateFrom.After(asOfDate) {
			return apperrors.BadRequest("date_from must be on or before as_of_date", nil)
		}
	}
	if query.DateTo != "" {
		if _, err := parseRequiredDate(query.DateTo, "date_to"); err != nil {
			return err
		}
	}
	if query.ItemType != "" {
		switch query.ItemType {
		case "product", "product_variant", "ingredient", "packaging":
		default:
			return apperrors.BadRequest("item_type must be product, product_variant, ingredient, or packaging", nil)
		}
	}
	if query.Status != "" && query.Status != "matched" && query.Status != "mismatch" {
		return apperrors.BadRequest("status must be matched or mismatch", nil)
	}
	branchID := cleanStringPointer(&query.BranchID)
	return s.validateJournalBranch(s.db, currentUser, branchID)
}

func reconciliationCheck(key, label string, operational, ledger float64, notes string) ReconciliationCheckResponse {
	operational = roundMoney(operational)
	ledger = roundMoney(ledger)
	difference := roundMoney(operational - ledger)
	matched := absMoney(difference) <= 0.01
	status := "matched"
	if !matched {
		status = "unmatched"
	}
	return ReconciliationCheckResponse{
		CheckKey:          key,
		Label:             label,
		OperationalAmount: operational,
		LedgerAmount:      ledger,
		Difference:        difference,
		IsMatched:         matched,
		Status:            status,
		Notes:             notes,
	}
}

func inventoryReconciliationDetailFromRow(row inventoryReconciliationDetailRow) InventoryReconciliationDetailItem {
	operational := roundMoney(row.OperationalInventoryValue)
	ledger := roundMoney(row.InventoryLedgerValue)
	accounting := roundMoney(row.AccountingInventoryValue)
	difference := roundMoney(operational - accounting)
	status := "matched"
	if absMoney(roundMoney(operational-ledger)) > 0.01 || absMoney(difference) > 0.01 {
		status = "mismatch"
	}
	item := InventoryReconciliationDetailItem{
		InventoryItemID:           row.InventoryItemID,
		ItemName:                  row.ItemName,
		ItemType:                  row.ItemType,
		ProductID:                 row.ProductID,
		ProductVariantID:          row.ProductVariantID,
		BranchID:                  row.BranchID,
		BranchName:                row.BranchName,
		StockLocationID:           row.StockLocationID,
		StockLocationName:         row.StockLocationName,
		OperationalQuantity:       roundMoney(row.OperationalQuantity),
		OperationalInventoryValue: operational,
		InventoryLedgerValue:      ledger,
		AccountingInventoryValue:  accounting,
		DifferenceAmount:          difference,
		LastTransactionID:         row.LastTransactionID,
		LastTransactionType:       row.LastTransactionType,
		LastTransactionReference:  row.LastTransactionReference,
		LastTransactionAt:         row.LastTransactionAt,
		PendingAccountingCount:    row.GRNOnlyCount,
		PendingAccountingValue:    roundMoney(row.GRNOnlyValue),
		Status:                    status,
	}
	item.PossibleReason = inventoryReconciliationReason(row, item)
	item.PossibleReasonKey = inventoryReconciliationReasonKey(row, item)
	return item
}

func inventoryReconciliationReason(row inventoryReconciliationDetailRow, item InventoryReconciliationDetailItem) string {
	if item.Status == "matched" {
		return "Operational inventory, stock movement valuation, and linked accounting value are matched."
	}
	if row.MissingCostCount > 0 {
		return "One or more value-affecting stock movements have missing or zero total cost."
	}
	if row.LinkedUnpostedCount > 0 {
		return "A stock movement is linked to a journal that is not posted."
	}
	if row.LinkedNoInventoryLineCount > 0 {
		return "A linked journal does not include the mapped Inventory / Stock account."
	}
	if row.PurchaseReturnMissingCount > 0 {
		return "Purchase return or Vendor Credit stock-out movement is missing its accounting journal link."
	}
	if row.POSCOGSMissingCount > 0 {
		return "POS sale stock-out movement is missing its COGS accounting journal link."
	}
	if row.ManufacturingMissingCount > 0 {
		return "Manufacturing stock movement is missing its accounting journal link."
	}
	if row.AdjustmentMissingCount > 0 {
		return "Opening stock, adjustment, or wastage stock movement is missing accounting posting."
	}
	if row.GRNOnlyCount > 0 {
		return "Pending Bill Posting: stock is in operational inventory. Accounting inventory updates when the supplier bill is posted."
	}
	if row.MissingJournalCount > 0 {
		return "A value-affecting stock movement is missing accounting_journal_entry_id."
	}
	if row.TransferMovementCount > 0 && absMoney(roundMoney(item.OperationalInventoryValue-item.InventoryLedgerValue)) > 0.01 {
		return "Stock transfer location valuation may not align with the current operational location value."
	}
	if absMoney(roundMoney(item.OperationalInventoryValue-item.InventoryLedgerValue)) > 0.01 {
		return "Operational inventory value differs from signed stock movement valuation."
	}
	if absMoney(roundMoney(item.InventoryLedgerValue-item.AccountingInventoryValue)) > 0.01 {
		return "Stock movement valuation differs from linked posted accounting journals."
	}
	return "Inventory valuation differs from accounting value; review the last related transaction and unassigned Inventory / Stock journals."
}

func inventoryReconciliationReasonKey(row inventoryReconciliationDetailRow, item InventoryReconciliationDetailItem) string {
	if item.Status == "matched" {
		return "matched"
	}
	if row.MissingCostCount > 0 {
		return "missing_cost"
	}
	if row.LinkedUnpostedCount > 0 {
		return "linked_unposted_journal"
	}
	if row.LinkedNoInventoryLineCount > 0 {
		return "linked_journal_missing_inventory_line"
	}
	if row.PurchaseReturnMissingCount > 0 {
		return "purchase_return_missing_journal"
	}
	if row.POSCOGSMissingCount > 0 {
		return "pos_cogs_missing_journal"
	}
	if row.ManufacturingMissingCount > 0 {
		return "manufacturing_missing_journal"
	}
	if row.AdjustmentMissingCount > 0 {
		return "adjustment_missing_journal"
	}
	if row.GRNOnlyCount > 0 {
		return "pending_bill_posting"
	}
	if row.MissingJournalCount > 0 {
		return "missing_journal"
	}
	if row.TransferMovementCount > 0 && absMoney(roundMoney(item.OperationalInventoryValue-item.InventoryLedgerValue)) > 0.01 {
		return "transfer_location_value_mismatch"
	}
	if absMoney(roundMoney(item.OperationalInventoryValue-item.InventoryLedgerValue)) > 0.01 {
		return "operational_stock_ledger_mismatch"
	}
	if absMoney(roundMoney(item.InventoryLedgerValue-item.AccountingInventoryValue)) > 0.01 {
		return "stock_ledger_accounting_mismatch"
	}
	return "inventory_accounting_mismatch"
}

func sortInventoryReconciliationDetails(items []InventoryReconciliationDetailItem, sortBy, sortOrder string) {
	desc := strings.ToLower(sortOrder) != "asc"
	sort.SliceStable(items, func(i, j int) bool {
		compare := 0
		switch sortBy {
		case "item_name":
			compare = strings.Compare(strings.ToLower(items[i].ItemName), strings.ToLower(items[j].ItemName))
		case "branch_name":
			compare = strings.Compare(strings.ToLower(items[i].BranchName), strings.ToLower(items[j].BranchName))
		case "stock_location_name":
			compare = strings.Compare(strings.ToLower(items[i].StockLocationName), strings.ToLower(items[j].StockLocationName))
		case "status":
			compare = strings.Compare(items[i].Status, items[j].Status)
		case "operational_inventory_value":
			compare = compareFloat(items[i].OperationalInventoryValue, items[j].OperationalInventoryValue)
		case "inventory_ledger_value":
			compare = compareFloat(items[i].InventoryLedgerValue, items[j].InventoryLedgerValue)
		case "accounting_inventory_value":
			compare = compareFloat(items[i].AccountingInventoryValue, items[j].AccountingInventoryValue)
		case "last_transaction_at":
			if items[i].LastTransactionAt == nil {
				compare = -1
			} else if items[j].LastTransactionAt == nil {
				compare = 1
			} else {
				compare = compareTime(*items[i].LastTransactionAt, *items[j].LastTransactionAt)
			}
		default:
			compare = compareFloat(absMoney(items[i].DifferenceAmount), absMoney(items[j].DifferenceAmount))
		}
		if compare == 0 {
			compare = strings.Compare(items[i].InventoryItemID+items[i].StockLocationName, items[j].InventoryItemID+items[j].StockLocationName)
		}
		if desc {
			return compare > 0
		}
		return compare < 0
	})
}

func compareFloat(left, right float64) int {
	if left < right {
		return -1
	}
	if left > right {
		return 1
	}
	return 0
}

func compareTime(left, right time.Time) int {
	if left.Before(right) {
		return -1
	}
	if left.After(right) {
		return 1
	}
	return 0
}

func paginateInventoryReconciliationDetails(items []InventoryReconciliationDetailItem, page, limit int) []InventoryReconciliationDetailItem {
	start := (page - 1) * limit
	if start >= len(items) {
		return []InventoryReconciliationDetailItem{}
	}
	end := start + limit
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

func normalizeBackfillRequest(req BackfillJournalsRequest) BackfillJournalsRequest {
	req.BranchID = strings.TrimSpace(req.BranchID)
	req.DateFrom = strings.TrimSpace(req.DateFrom)
	req.DateTo = strings.TrimSpace(req.DateTo)
	if req.Limit <= 0 {
		req.Limit = 100
	}
	if req.Limit > 500 {
		req.Limit = 500
	}
	if len(req.Targets) == 0 {
		req.Targets = defaultBackfillTargets()
	}
	normalized := make([]string, 0, len(req.Targets))
	seen := map[string]struct{}{}
	for _, target := range req.Targets {
		target = strings.ToLower(strings.TrimSpace(target))
		if target == "" {
			continue
		}
		if _, exists := seen[target]; exists {
			continue
		}
		seen[target] = struct{}{}
		normalized = append(normalized, target)
	}
	req.Targets = normalized
	return req
}

func (s *Service) validateBackfillRequest(currentUser *utils.AuthContext, req BackfillJournalsRequest) error {
	if len(req.Targets) == 0 {
		return apperrors.BadRequest("targets is required", nil)
	}
	for _, target := range req.Targets {
		if !validBackfillTarget(target) {
			return apperrors.BadRequest("invalid backfill target", map[string]string{"target": target})
		}
	}
	if req.DateFrom != "" {
		if _, err := parseRequiredDate(req.DateFrom, "date_from"); err != nil {
			return err
		}
	}
	if req.DateTo != "" {
		if _, err := parseRequiredDate(req.DateTo, "date_to"); err != nil {
			return err
		}
	}
	if req.DateFrom != "" && req.DateTo != "" && req.DateFrom > req.DateTo {
		return apperrors.BadRequest("date_from must be before or equal to date_to", nil)
	}
	if req.BranchID != "" {
		return s.validateJournalBranch(s.db, currentUser, &req.BranchID)
	}
	return nil
}

func defaultBackfillTargets() []string {
	return []string{
		"pos_sales",
		"bakery_order_payments",
		"payment_refunds",
		"bakery_orders",
		"purchase_invoices",
		"supplier_payments",
		"stock_movements",
		"manufacturing_batches",
		"sales_returns",
		"purchase_returns",
		"expenses",
	}
}

func backfillReadinessTargets(query BackfillReadinessQuery) []string {
	if len(query.Targets) > 0 {
		return query.Targets
	}
	return defaultBackfillTargets()
}

func validBackfillTarget(value string) bool {
	switch value {
	case "pos_sales", "bakery_orders", "bakery_order_payments", "payment_refunds", "purchase_invoices", "purchase_invoice_payments", "supplier_payments", "stock_movements", "manufacturing_batches", "sales_returns", "purchase_returns", "expenses":
		return true
	default:
		return false
	}
}

func backfillRequiredMappingKeys() []string {
	return []string{
		"accounts_receivable",
		"accounts_payable",
		"supplier_advance",
		"inventory_stock",
		"sales_income",
		"bakery_income",
		"customer_advance",
		"vat_receivable",
		"vat_payable",
		"cogs",
		"sales_returns",
		"purchase_returns",
		"wip_inventory",
		"wastage_expense",
		"opening_balance_equity",
		"grni",
		"platform_commission_expense",
		"inventory_adjustment_gain",
		"inventory_adjustment_loss",
		"delivery_charge_income",
		"service_charge_income",
		"packing_charge_income",
		"freight_inward",
		"charge_refund_account",
	}
}

func coalesceText(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return fallback
}

func validateFinancialYearStart(month, day int) error {
	if month < 1 || month > 12 {
		return apperrors.BadRequest("financial_year_start_month must be between 1 and 12", nil)
	}
	if day < 1 || day > 31 {
		return apperrors.BadRequest("financial_year_start_day must be between 1 and 31", nil)
	}
	parsed := time.Date(2001, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if int(parsed.Month()) != month || parsed.Day() != day {
		return apperrors.BadRequest("financial year start date is invalid", nil)
	}
	return nil
}

func toAccountingSettingsResponse(row *accountingSettingsRow) AccountingSettingsResponse {
	labelDate := time.Date(2001, time.Month(row.FinancialYearStartMonth), row.FinancialYearStartDay, 0, 0, 0, 0, time.UTC)
	return AccountingSettingsResponse{
		BusinessID:               row.BusinessID,
		FinancialYearStartMonth:  row.FinancialYearStartMonth,
		FinancialYearStartDay:    row.FinancialYearStartDay,
		FinancialYearStartLabel:  labelDate.Format("January 2"),
		UsesDefaultFinancialYear: row.FinancialYearStartMonth == 1 && row.FinancialYearStartDay == 1,
		CreatedAt:                row.CreatedAt,
		UpdatedAt:                row.UpdatedAt,
	}
}

func financialYearStartFor(asOfDate time.Time, month, day int) time.Time {
	start := time.Date(asOfDate.Year(), time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if start.After(asOfDate) {
		start = start.AddDate(-1, 0, 0)
	}
	return start
}

func balanceLabel(value float64) string {
	if value < 0 {
		return "Cr"
	}
	return "Dr"
}

func (s *Service) loadActivePaymentAccount(currentUser *utils.AuthContext, id string) (*PaymentAccount, error) {
	if _, err := uuid.Parse(strings.TrimSpace(id)); err != nil {
		return nil, apperrors.BadRequest("payment account id must be a valid UUID", nil)
	}
	account, err := s.repo.FindPaymentAccountByID(currentUser.BusinessID, strings.TrimSpace(id))
	if err != nil {
		return nil, mapPaymentAccountNotFound(err)
	}
	if account.Status != "active" {
		return nil, apperrors.BadRequest("payment account is inactive", nil)
	}
	if account.BranchID != nil && *account.BranchID != "" && !currentUser.CanAccessBranch(*account.BranchID) {
		return nil, apperrors.Forbidden("branch access denied")
	}
	return account, nil
}

func (s *Service) resolvePaymentOperationBranch(currentUser *utils.AuthContext, requested *string, accounts ...*PaymentAccount) (*string, error) {
	if requested != nil && *requested != "" {
		if err := s.validateJournalBranch(s.db, currentUser, requested); err != nil {
			return nil, err
		}
		for _, account := range accounts {
			if account.BranchID != nil && *account.BranchID != "" && *account.BranchID != *requested {
				return nil, apperrors.BadRequest("payment account branch does not match branch_id", nil)
			}
		}
		return requested, nil
	}
	var resolved *string
	for _, account := range accounts {
		if account.BranchID == nil || *account.BranchID == "" {
			continue
		}
		if !currentUser.CanAccessBranch(*account.BranchID) {
			return nil, apperrors.Forbidden("branch access denied")
		}
		if resolved == nil {
			branchID := *account.BranchID
			resolved = &branchID
			continue
		}
		if *resolved != *account.BranchID {
			return nil, apperrors.BadRequest("cross-branch payment account operations are not supported in this phase", nil)
		}
	}
	return resolved, nil
}

func (s *Service) buildPlatformSettlementDeductions(businessID string, requests []PlatformSettlementDeductionRequest) ([]PlatformSettlementDeduction, []JournalEntryLineRequest, float64, error) {
	deductions := make([]PlatformSettlementDeduction, 0, len(requests))
	lines := make([]JournalEntryLineRequest, 0, len(requests))
	total := 0.0
	for i, req := range requests {
		accountID := strings.TrimSpace(req.ExpenseAccountID)
		if _, err := uuid.Parse(accountID); err != nil {
			return nil, nil, 0, apperrors.BadRequest("expense_account_id must be a valid UUID", map[string]interface{}{"line_number": i + 1})
		}
		account, err := s.repo.ValidateActiveAccount(s.db, businessID, accountID)
		if err != nil {
			return nil, nil, 0, apperrors.BadRequest("invalid expense_account_id", map[string]interface{}{"line_number": i + 1})
		}
		if account.AccountType != "expense" && account.AccountType != "cogs" {
			return nil, nil, 0, apperrors.BadRequest("deduction expense_account_id must be an expense or cogs account", map[string]interface{}{"line_number": i + 1})
		}
		deductionType := strings.TrimSpace(req.DeductionType)
		if deductionType == "" {
			return nil, nil, 0, apperrors.BadRequest("deduction_type is required", map[string]interface{}{"line_number": i + 1})
		}
		amount := roundMoney(req.Amount)
		if amount <= 0 {
			return nil, nil, 0, apperrors.BadRequest("deduction amount must be greater than 0", map[string]interface{}{"line_number": i + 1})
		}
		description := strings.TrimSpace(req.Description)
		if description == "" {
			description = deductionType
		}
		deductions = append(deductions, PlatformSettlementDeduction{
			ID:               utils.NewUUID(),
			BusinessID:       businessID,
			ExpenseAccountID: account.ID,
			DeductionType:    deductionType,
			Description:      description,
			Amount:           amount,
		})
		lines = append(lines, JournalEntryLineRequest{AccountID: account.ID, DebitAmount: amount, Description: "Platform deduction: " + description})
		total = roundMoney(total + amount)
	}
	return deductions, lines, total, nil
}

func (s *Service) createPostedTransferJournal(tx *gorm.DB, currentUser *utils.AuthContext, entryDate time.Time, branchID *string, sourceType, sourceID, referenceNumber, narration string, lineRequests []JournalEntryLineRequest) (string, error) {
	entryID := utils.NewUUID()
	lines, totalDebit, totalCredit, err := s.buildJournalLines(tx, currentUser.BusinessID, entryID, lineRequests)
	if err != nil {
		return "", err
	}
	entryNumber, err := s.repo.NextJournalEntryNumber(tx, currentUser.BusinessID, entryDate)
	if err != nil {
		return "", apperrors.Internal("failed to generate journal entry number")
	}
	now := time.Now().UTC()
	entrySourceID := sourceID
	entry := &JournalEntry{
		ID:              entryID,
		BusinessID:      currentUser.BusinessID,
		BranchID:        branchID,
		EntryNumber:     entryNumber,
		EntryDate:       entryDate,
		ReferenceNumber: strings.TrimSpace(referenceNumber),
		SourceType:      sourceType,
		SourceID:        &entrySourceID,
		Narration:       strings.TrimSpace(narration),
		Status:          "posted",
		TotalDebit:      totalDebit,
		TotalCredit:     totalCredit,
		PostedAt:        &now,
		PostedByUserID:  &currentUser.UserID,
		CreatedByUserID: currentUser.UserID,
		UpdatedByUserID: &currentUser.UserID,
	}
	if err := s.repo.CreateJournalEntry(tx, entry, lines); err != nil {
		return "", apperrors.Internal("failed to create accounting journal")
	}
	return entryID, nil
}

func (s *Service) createPostedSystemJournal(tx *gorm.DB, currentUser *utils.AuthContext, entryDate time.Time, branchID *string, sourceType, sourceID, referenceNumber, narration string, lineRequests []JournalEntryLineRequest) (string, error) {
	if sourceType != "" && sourceID != "" {
		existing, err := s.repo.FindPostedJournalBySource(tx, currentUser.BusinessID, sourceType, sourceID)
		if err == nil && existing.ID != "" {
			return existing.ID, nil
		}
		if err != nil && err != gorm.ErrRecordNotFound {
			return "", apperrors.Internal("failed to validate existing accounting journal")
		}
	}
	entryID := utils.NewUUID()
	lines, totalDebit, totalCredit, err := s.buildSystemJournalLines(tx, currentUser.BusinessID, entryID, lineRequests)
	if err != nil {
		return "", err
	}
	entryNumber, err := s.repo.NextJournalEntryNumber(tx, currentUser.BusinessID, entryDate)
	if err != nil {
		return "", apperrors.Internal("failed to generate journal entry number")
	}
	now := time.Now().UTC()
	entrySourceID := sourceID
	entry := &JournalEntry{
		ID:              entryID,
		BusinessID:      currentUser.BusinessID,
		BranchID:        branchID,
		EntryNumber:     entryNumber,
		EntryDate:       entryDate,
		ReferenceNumber: strings.TrimSpace(referenceNumber),
		SourceType:      sourceType,
		SourceID:        &entrySourceID,
		Narration:       strings.TrimSpace(narration),
		Status:          "posted",
		TotalDebit:      totalDebit,
		TotalCredit:     totalCredit,
		PostedAt:        &now,
		PostedByUserID:  &currentUser.UserID,
		CreatedByUserID: currentUser.UserID,
		UpdatedByUserID: &currentUser.UserID,
	}
	if err := s.repo.CreateJournalEntry(tx, entry, lines); err != nil {
		return "", apperrors.Internal("failed to create accounting journal")
	}
	return entryID, nil
}

func (s *Service) buildSystemJournalLines(tx *gorm.DB, businessID, entryID string, lineRequests []JournalEntryLineRequest) ([]JournalEntryLine, float64, float64, error) {
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

func (s *Service) requiredAccount(tx *gorm.DB, businessID, accountCode, accountName string) (*ChartAccount, error) {
	account, err := s.repo.FindActiveAccountByCode(tx, businessID, accountCode)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.BadRequest("required accounting account is missing; seed default chart of accounts", map[string]interface{}{"account_code": accountCode, "account_name": accountName})
		}
		return nil, apperrors.Internal("failed to load required accounting account")
	}
	return account, nil
}

func (s *Service) requiredMappedAccount(tx *gorm.DB, businessID, mappingKey, fallbackCode, fallbackName string) (*ChartAccount, error) {
	mapping, err := s.repo.FindAccountMapping(tx, businessID, mappingKey)
	if err == nil {
		account, err := s.repo.ValidateActiveAccount(tx, businessID, mapping.ChartAccountID)
		if err != nil {
			return nil, apperrors.BadRequest("mapped accounting account is inactive or missing", map[string]interface{}{"mapping_key": mappingKey})
		}
		return account, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, apperrors.Internal("failed to load account mapping")
	}
	account, err := s.requiredAccount(tx, businessID, fallbackCode, fallbackName)
	if err != nil {
		return nil, err
	}
	_ = s.repo.UpsertAccountMapping(tx, &AccountMapping{
		ID:             utils.NewUUID(),
		BusinessID:     businessID,
		MappingKey:     mappingKey,
		ChartAccountID: account.ID,
		Description:    defaultAccountMappingDescription(mappingKey),
	})
	return account, nil
}

func (s *Service) buildChargeCreditLines(tx *gorm.DB, businessID, documentType, documentID, descriptionPrefix string) ([]JournalEntryLineRequest, float64, error) {
	rows, err := s.repo.ListDocumentChargesForAccounting(tx, businessID, documentType, documentID)
	if err != nil {
		return nil, 0, apperrors.Internal("failed to load document charges for accounting")
	}
	lines := make([]JournalEntryLineRequest, 0, len(rows))
	totalNet := 0.0
	for _, row := range rows {
		netAmount := roundMoney(row.TotalAmount - row.TaxAmount)
		if netAmount <= 0 {
			continue
		}
		account, err := s.chargeIncomeAccount(tx, businessID, row.ChargeType)
		if err != nil {
			return nil, 0, err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: account.ID, CreditAmount: netAmount, Description: descriptionPrefix + ": " + row.ChargeName})
		totalNet = roundMoney(totalNet + netAmount)
	}
	return lines, totalNet, nil
}

func (s *Service) buildChargeRefundDebitLines(tx *gorm.DB, businessID, documentType, documentID, descriptionPrefix string) ([]JournalEntryLineRequest, float64, error) {
	rows, err := s.repo.ListDocumentChargesForAccounting(tx, businessID, documentType, documentID)
	if err != nil {
		return nil, 0, apperrors.Internal("failed to load charge refunds for accounting")
	}
	if len(rows) == 0 {
		return nil, 0, nil
	}
	account, err := s.requiredMappedAccount(tx, businessID, "charge_refund_account", "4080", "Delivery Charge Returns")
	if err != nil {
		return nil, 0, err
	}
	lines := make([]JournalEntryLineRequest, 0, len(rows))
	totalNet := 0.0
	for _, row := range rows {
		netAmount := roundMoney(row.TotalAmount - row.TaxAmount)
		if netAmount <= 0 {
			continue
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: account.ID, DebitAmount: netAmount, Description: descriptionPrefix + ": " + row.ChargeName})
		totalNet = roundMoney(totalNet + netAmount)
	}
	return lines, totalNet, nil
}

func (s *Service) buildPurchaseChargeDebitLines(tx *gorm.DB, businessID, documentType, documentID, descriptionPrefix string) ([]JournalEntryLineRequest, float64, error) {
	rows, err := s.repo.ListDocumentChargesForAccounting(tx, businessID, documentType, documentID)
	if err != nil {
		return nil, 0, apperrors.Internal("failed to load purchase charges for accounting")
	}
	lines := make([]JournalEntryLineRequest, 0, len(rows))
	totalNet := 0.0
	for _, row := range rows {
		netAmount := roundMoney(row.TotalAmount - row.TaxAmount)
		if netAmount <= 0 {
			continue
		}
		account, err := s.purchaseChargeAccount(tx, businessID, row.ChargeType)
		if err != nil {
			return nil, 0, err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: account.ID, DebitAmount: netAmount, Description: descriptionPrefix + ": " + row.ChargeName})
		totalNet = roundMoney(totalNet + netAmount)
	}
	return lines, totalNet, nil
}

func (s *Service) buildPurchaseChargeCreditLines(tx *gorm.DB, businessID, documentType, documentID, descriptionPrefix string) ([]JournalEntryLineRequest, float64, error) {
	rows, err := s.repo.ListDocumentChargesForAccounting(tx, businessID, documentType, documentID)
	if err != nil {
		return nil, 0, apperrors.Internal("failed to load purchase charge credits for accounting")
	}
	lines := make([]JournalEntryLineRequest, 0, len(rows))
	totalNet := 0.0
	for _, row := range rows {
		netAmount := roundMoney(row.TotalAmount - row.TaxAmount)
		if netAmount <= 0 {
			continue
		}
		account, err := s.purchaseChargeAccount(tx, businessID, row.ChargeType)
		if err != nil {
			return nil, 0, err
		}
		lines = append(lines, JournalEntryLineRequest{AccountID: account.ID, CreditAmount: netAmount, Description: descriptionPrefix + ": " + row.ChargeName})
		totalNet = roundMoney(totalNet + netAmount)
	}
	return lines, totalNet, nil
}

func (s *Service) chargeIncomeAccount(tx *gorm.DB, businessID, chargeType string) (*ChartAccount, error) {
	switch chargeType {
	case "delivery":
		return s.requiredMappedAccount(tx, businessID, "delivery_charge_income", "4050", "Delivery Charge Income")
	case "packing":
		return s.requiredMappedAccount(tx, businessID, "packing_charge_income", "4070", "Packing Charge Income")
	default:
		return s.requiredMappedAccount(tx, businessID, "service_charge_income", "4060", "Service Charge Income")
	}
}

func (s *Service) purchaseChargeAccount(tx *gorm.DB, businessID, chargeType string) (*ChartAccount, error) {
	return s.requiredMappedAccount(tx, businessID, "freight_inward", "5030", "Freight / Carriage Inward")
}

func validAccountMappingKey(value string) bool {
	switch value {
	case "accounts_receivable", "accounts_payable", "inventory_stock", "sales_income", "bakery_income",
		"customer_advance", "vat_receivable", "vat_payable", "cogs", "sales_returns",
		"purchase_returns", "wip_inventory", "wastage_expense", "opening_balance_equity",
		"grni", "supplier_advance", "platform_commission_expense", "delivery_charge_income", "service_charge_income",
		"packing_charge_income", "freight_inward", "charge_refund_account", "inventory_adjustment_gain", "inventory_adjustment_loss":
		return true
	default:
		return false
	}
}

func defaultAccountMappingDescription(value string) string {
	for _, seed := range DefaultAccountMappingSeeds() {
		if seed.Key == value {
			return seed.Description
		}
	}
	return value
}

func validatePaymentAccountBranch(paymentAccountBranchID *string, documentBranchID, paymentAccountName string) error {
	if paymentAccountBranchID == nil || strings.TrimSpace(*paymentAccountBranchID) == "" {
		return nil
	}
	if *paymentAccountBranchID != documentBranchID {
		return apperrors.BadRequest("payment account is not available for this branch", map[string]interface{}{"payment_account": paymentAccountName})
	}
	return nil
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

func mapPaymentAccountNotFound(err error) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound("payment account not found")
	}
	return apperrors.Internal("failed to load payment account")
}

func mapAccountTransferNotFound(err error) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound("account transfer not found")
	}
	return apperrors.Internal("failed to load account transfer")
}

func mapPlatformSettlementNotFound(err error) error {
	if err == gorm.ErrRecordNotFound {
		return apperrors.NotFound("platform settlement not found")
	}
	return apperrors.Internal("failed to load platform settlement")
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
	entityType := accountingAuditEntityType(eventType)
	metadata := s.accountingAuditMetadata(tx, currentUser.BusinessID, entityType, entityID)
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: entityType, EntityID: entityID, Summary: summary, Metadata: audit.Metadata(metadata, nil), IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func accountingAuditEntityType(eventType string) string {
	switch {
	case strings.Contains(eventType, "journal_entry"):
		return "journal_entry"
	case strings.Contains(eventType, "chart_account"):
		return "chart_account"
	case strings.Contains(eventType, "payment_account"):
		return "payment_account"
	case strings.Contains(eventType, "account_transfer"):
		return "account_transfer"
	case strings.Contains(eventType, "platform_settlement"):
		return "platform_settlement"
	case strings.Contains(eventType, "settings"), strings.Contains(eventType, "mapping"):
		return "accounting"
	default:
		return "accounting"
	}
}

func (s *Service) writeEntityAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string) error {
	metadata := s.accountingAuditMetadata(tx, currentUser.BusinessID, entityType, entityID)
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: entityType, EntityID: entityID, Summary: summary, Metadata: audit.Metadata(metadata, nil), IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func (s *Service) accountingAuditMetadata(tx *gorm.DB, businessID, entityType, entityID string) map[string]interface{} {
	metadata := map[string]interface{}{"source_module": "accounting"}
	if tx == nil || strings.TrimSpace(entityID) == "" {
		return metadata
	}
	switch accountingAuditEntityType(entityType) {
	case "journal_entry":
		var row struct{ EntryNumber, ReferenceNumber string }
		_ = tx.Unscoped().Table("journal_entries").Select("entry_number, reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["entry_number"] = row.EntryNumber
		metadata["journal_entry_number"] = row.EntryNumber
		metadata["reference_number"] = row.ReferenceNumber
		metadata["document_number"] = auditFirstNonEmpty(row.EntryNumber, row.ReferenceNumber)
	case "account_transfer":
		var row struct{ TransferNumber, ReferenceNumber string }
		_ = tx.Unscoped().Table("account_transfers").Select("transfer_number, reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["transfer_number"] = row.TransferNumber
		metadata["reference_number"] = row.ReferenceNumber
		metadata["document_number"] = auditFirstNonEmpty(row.TransferNumber, row.ReferenceNumber)
	case "platform_settlement":
		var row struct{ SettlementNumber, ReferenceNumber string }
		_ = tx.Unscoped().Table("platform_settlements").Select("settlement_number, reference_number").Where("business_id = ? AND id = ?", businessID, entityID).Scan(&row).Error
		metadata["settlement_number"] = row.SettlementNumber
		metadata["reference_number"] = row.ReferenceNumber
		metadata["document_number"] = auditFirstNonEmpty(row.SettlementNumber, row.ReferenceNumber)
	}
	return metadata
}

func auditFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
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
