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
	salesIncome, err := s.requiredAccount(tx, currentUser.BusinessID, "4000", "Sales Income")
	if err != nil {
		return "", err
	}
	accountsReceivable, err := s.requiredAccount(tx, currentUser.BusinessID, "1100", "Accounts Receivable")
	if err != nil {
		return "", err
	}
	var vatPayable *ChartAccount
	taxAmount := roundMoney(sale.TaxAmount)
	if taxAmount > 0 {
		vatPayable, err = s.requiredAccount(tx, currentUser.BusinessID, "2100", "VAT Payable")
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

	lines := make([]JournalEntryLineRequest, 0, len(paymentDebits)+3)
	for accountID, amount := range paymentDebits {
		if amount > 0 {
			lines = append(lines, JournalEntryLineRequest{AccountID: accountID, DebitAmount: amount, Description: paymentDescriptions[accountID]})
		}
	}
	balanceAmount := roundMoney(totalAmount - collectedTotal)
	if balanceAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: accountsReceivable.ID, DebitAmount: balanceAmount, Description: "POS sale receivable"})
	}
	revenueAmount := roundMoney(totalAmount - taxAmount)
	if revenueAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: salesIncome.ID, CreditAmount: revenueAmount, Description: "POS sale income"})
	}
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
	creditAccountCode := "2200"
	creditAccountName := "Customer Advance"
	if payment.OrderStatus == "completed" {
		creditAccountCode = "1100"
		creditAccountName = "Accounts Receivable"
	}
	creditAccount, err := s.requiredAccount(tx, currentUser.BusinessID, creditAccountCode, creditAccountName)
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
	customerAdvance, err := s.requiredAccount(tx, currentUser.BusinessID, "2200", "Customer Advance")
	if err != nil {
		return "", err
	}
	accountsReceivable, err := s.requiredAccount(tx, currentUser.BusinessID, "1100", "Accounts Receivable")
	if err != nil {
		return "", err
	}
	bakeryIncome, err := s.requiredAccount(tx, currentUser.BusinessID, "4010", "Bakery Order Income")
	if err != nil {
		return "", err
	}
	var vatPayable *ChartAccount
	taxAmount := roundMoney(order.TaxAmount)
	if taxAmount > 0 {
		vatPayable, err = s.requiredAccount(tx, currentUser.BusinessID, "2100", "VAT Payable")
		if err != nil {
			return "", err
		}
	}
	paidAmount := roundMoney(order.PaidAmount)
	if paidAmount > totalAmount {
		paidAmount = totalAmount
	}
	balanceAmount := roundMoney(totalAmount - paidAmount)
	lines := make([]JournalEntryLineRequest, 0, 4)
	if paidAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: customerAdvance.ID, DebitAmount: paidAmount, Description: "Recognize paid bakery order advance"})
	}
	if balanceAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: accountsReceivable.ID, DebitAmount: balanceAmount, Description: "Bakery order receivable"})
	}
	revenueAmount := roundMoney(totalAmount - taxAmount)
	if revenueAmount > 0 {
		lines = append(lines, JournalEntryLineRequest{AccountID: bakeryIncome.ID, CreditAmount: revenueAmount, Description: "Bakery order income"})
	}
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
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: "chart_account", EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
		return apperrors.Internal("failed to create activity log")
	}
	return nil
}

func (s *Service) writeEntityAudit(tx *gorm.DB, currentUser *utils.AuthContext, eventType, entityType, entityID, summary, ipAddress, userAgent string) error {
	if err := s.auditRepo.CreateActivity(tx, audit.ActivityInput{BusinessID: currentUser.BusinessID, ActorUserID: currentUser.UserID, EventType: eventType, EntityType: entityType, EntityID: entityID, Summary: summary, IPAddress: ipAddress, UserAgent: userAgent}); err != nil {
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
