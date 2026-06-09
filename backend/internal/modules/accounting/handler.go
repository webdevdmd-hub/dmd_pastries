package accounting

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/response"
	"pastries-pos/internal/shared/utils"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListChartAccounts(c *gin.Context) {
	result, err := h.service.ListChartAccounts(utils.MustAuthContext(c), parseChartAccountListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart of accounts fetched successfully", result)
}

func (h *Handler) SeedDefaults(c *gin.Context) {
	if err := h.service.SeedDefaults(utils.MustAuthContext(c), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart of accounts defaults seeded successfully", gin.H{"seeded": true})
}

func (h *Handler) ListAccountMappings(c *gin.Context) {
	result, err := h.service.ListAccountMappings(utils.MustAuthContext(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "account mappings fetched successfully", result)
}

func (h *Handler) SeedAccountMappings(c *gin.Context) {
	result, err := h.service.SeedAccountMappings(utils.MustAuthContext(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "account mappings defaults seeded successfully", result)
}

func (h *Handler) UpdateAccountMappings(c *gin.Context) {
	var req UpdateAccountMappingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateAccountMappings(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "account mappings updated successfully", result)
}

func (h *Handler) GetAccountingSettings(c *gin.Context) {
	result, err := h.service.GetAccountingSettings(utils.MustAuthContext(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounting settings fetched successfully", result)
}

func (h *Handler) UpdateAccountingSettings(c *gin.Context) {
	var req UpdateAccountingSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateAccountingSettings(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounting settings updated successfully", result)
}

func (h *Handler) BackfillJournals(c *gin.Context) {
	var req BackfillJournalsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.BackfillJournals(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounting journal backfill completed", result)
}

func (h *Handler) GetBackfillReadiness(c *gin.Context) {
	result, err := h.service.GetBackfillReadiness(utils.MustAuthContext(c), parseBackfillReadinessQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounting backfill readiness fetched successfully", result)
}

func (h *Handler) CreateChartAccount(c *gin.Context) {
	var req CreateChartAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateChartAccount(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "chart account created successfully", result)
}

func (h *Handler) GetChartAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetChartAccount(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart account fetched successfully", result)
}

func (h *Handler) GetLedgerDetails(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetLedgerDetails(utils.MustAuthContext(c), c.Param("id"), parseLedgerDetailsQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "ledger details fetched successfully", result)
}

func (h *Handler) UpdateChartAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateChartAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateChartAccount(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart account updated successfully", result)
}

func (h *Handler) UpdateChartAccountStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateChartAccountStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateChartAccountStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart account status updated successfully", result)
}

func (h *Handler) DeleteChartAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	if err := h.service.DeleteChartAccount(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "chart account deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListPaymentAccounts(c *gin.Context) {
	result, err := h.service.ListPaymentAccounts(utils.MustAuthContext(c), parsePaymentAccountListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment accounts fetched successfully", result)
}

func (h *Handler) CreatePaymentAccount(c *gin.Context) {
	var req CreatePaymentAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreatePaymentAccount(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment account created successfully", result)
}

func (h *Handler) SeedDefaultPaymentAccounts(c *gin.Context) {
	result, err := h.service.SeedDefaultPaymentAccounts(utils.MustAuthContext(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "default payment accounts seeded successfully", result)
}

func (h *Handler) GetPaymentAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetPaymentAccount(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment account fetched successfully", result)
}

func (h *Handler) UpdatePaymentAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdatePaymentAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdatePaymentAccount(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment account updated successfully", result)
}

func (h *Handler) UpdatePaymentAccountStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateChartAccountStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdatePaymentAccountStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment account status updated successfully", result)
}

func (h *Handler) DeletePaymentAccount(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	if err := h.service.DeletePaymentAccount(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment account deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListAccountTransfers(c *gin.Context) {
	result, err := h.service.ListAccountTransfers(utils.MustAuthContext(c), parseAccountTransferListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "account transfers fetched successfully", result)
}

func (h *Handler) CreateAccountTransfer(c *gin.Context) {
	var req CreateAccountTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateAccountTransfer(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "account transfer created successfully", result)
}

func (h *Handler) GetAccountTransfer(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetAccountTransfer(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "account transfer fetched successfully", result)
}

func (h *Handler) ListPlatformSettlements(c *gin.Context) {
	result, err := h.service.ListPlatformSettlements(utils.MustAuthContext(c), parsePlatformSettlementListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "platform settlements fetched successfully", result)
}

func (h *Handler) CreatePlatformSettlement(c *gin.Context) {
	var req CreatePlatformSettlementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreatePlatformSettlement(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "platform settlement created successfully", result)
}

func (h *Handler) GetPlatformSettlement(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetPlatformSettlement(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "platform settlement fetched successfully", result)
}

func (h *Handler) ListJournalEntries(c *gin.Context) {
	result, err := h.service.ListJournalEntries(utils.MustAuthContext(c), parseJournalEntryListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "journal entries fetched successfully", result)
}

func (h *Handler) GetGeneralLedger(c *gin.Context) {
	result, err := h.service.GetGeneralLedger(utils.MustAuthContext(c), parseGeneralLedgerQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "general ledger fetched successfully", result)
}

func (h *Handler) GetTrialBalance(c *gin.Context) {
	result, err := h.service.GetTrialBalance(utils.MustAuthContext(c), parseTrialBalanceQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "trial balance fetched successfully", result)
}

func (h *Handler) GetProfitLoss(c *gin.Context) {
	result, err := h.service.GetProfitLoss(utils.MustAuthContext(c), parseProfitLossQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "profit and loss fetched successfully", result)
}

func (h *Handler) GetBalanceSheet(c *gin.Context) {
	result, err := h.service.GetBalanceSheet(utils.MustAuthContext(c), parseBalanceSheetQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "balance sheet fetched successfully", result)
}

func (h *Handler) GetReconciliationHealth(c *gin.Context) {
	result, err := h.service.GetReconciliationHealth(utils.MustAuthContext(c), parseReconciliationQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounting reconciliation health fetched successfully", result)
}

func (h *Handler) GetInventoryReconciliation(c *gin.Context) {
	result, err := h.service.GetInventoryReconciliation(utils.MustAuthContext(c), parseReconciliationQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory reconciliation fetched successfully", result)
}

func (h *Handler) GetAPReconciliation(c *gin.Context) {
	result, err := h.service.GetAPReconciliation(utils.MustAuthContext(c), parseReconciliationQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounts payable reconciliation fetched successfully", result)
}

func (h *Handler) GetARReconciliation(c *gin.Context) {
	result, err := h.service.GetARReconciliation(utils.MustAuthContext(c), parseReconciliationQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "accounts receivable reconciliation fetched successfully", result)
}

func (h *Handler) GetPaymentAccountReconciliation(c *gin.Context) {
	result, err := h.service.GetPaymentAccountReconciliation(utils.MustAuthContext(c), parseReconciliationQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment account reconciliation fetched successfully", result)
}

func (h *Handler) CreateJournalEntry(c *gin.Context) {
	var req CreateJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateJournalEntry(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "journal entry created successfully", result)
}

func (h *Handler) GetJournalEntry(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetJournalEntry(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "journal entry fetched successfully", result)
}

func (h *Handler) UpdateJournalEntry(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateJournalEntry(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "journal entry updated successfully", result)
}

func (h *Handler) PostJournalEntry(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.PostJournalEntry(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "journal entry posted successfully", result)
}

func (h *Handler) DeleteJournalEntry(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	if err := h.service.DeleteJournalEntry(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "journal entry hard deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ReverseJournalEntry(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req ReverseJournalEntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.ReverseJournalEntry(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "journal entry reversed successfully", result)
}

func parseChartAccountListQuery(c *gin.Context) ChartAccountListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return ChartAccountListQuery{
		Search:          c.Query("search"),
		AccountType:     c.Query("account_type"),
		AccountGroup:    c.Query("account_group"),
		Status:          c.Query("status"),
		ParentAccountID: c.Query("parent_account_id"),
		Page:            page,
		Limit:           limit,
		SortBy:          c.DefaultQuery("sort_by", "account_code"),
		SortOrder:       c.DefaultQuery("sort_order", "asc"),
	}
}

func parsePaymentAccountListQuery(c *gin.Context) PaymentAccountListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return PaymentAccountListQuery{
		Search:      c.Query("search"),
		BranchID:    c.Query("branch_id"),
		AccountType: c.Query("account_type"),
		Status:      c.Query("status"),
		Page:        page,
		Limit:       limit,
		SortBy:      c.DefaultQuery("sort_by", "account_name"),
		SortOrder:   c.DefaultQuery("sort_order", "asc"),
	}
}

func parseAccountTransferListQuery(c *gin.Context) AccountTransferListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return AccountTransferListQuery{
		BranchID:         c.Query("branch_id"),
		PaymentAccountID: c.Query("payment_account_id"),
		DateFrom:         c.Query("date_from"),
		DateTo:           c.Query("date_to"),
		Page:             page,
		Limit:            limit,
		SortOrder:        c.DefaultQuery("sort_order", "desc"),
	}
}

func parsePlatformSettlementListQuery(c *gin.Context) PlatformSettlementListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return PlatformSettlementListQuery{
		BranchID:                 c.Query("branch_id"),
		PlatformPaymentAccountID: c.Query("platform_payment_account_id"),
		DepositPaymentAccountID:  c.Query("deposit_payment_account_id"),
		DateFrom:                 c.Query("date_from"),
		DateTo:                   c.Query("date_to"),
		Page:                     page,
		Limit:                    limit,
		SortOrder:                c.DefaultQuery("sort_order", "desc"),
	}
}

func parseJournalEntryListQuery(c *gin.Context) JournalEntryListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return JournalEntryListQuery{
		Search:     c.Query("search"),
		BranchID:   c.Query("branch_id"),
		Status:     c.Query("status"),
		SourceType: c.Query("source_type"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
		Page:       page,
		Limit:      limit,
		SortBy:     c.DefaultQuery("sort_by", "entry_date"),
		SortOrder:  c.DefaultQuery("sort_order", "desc"),
	}
}

func parseGeneralLedgerQuery(c *gin.Context) GeneralLedgerQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return GeneralLedgerQuery{
		AccountID: c.Query("account_id"),
		BranchID:  c.Query("branch_id"),
		DateFrom:  c.Query("date_from"),
		DateTo:    c.Query("date_to"),
		Page:      page,
		Limit:     limit,
		SortOrder: c.DefaultQuery("sort_order", "asc"),
	}
}

func parseLedgerDetailsQuery(c *gin.Context) LedgerDetailsQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return LedgerDetailsQuery{
		BranchID:  c.Query("branch_id"),
		DateFrom:  c.Query("date_from"),
		DateTo:    c.Query("date_to"),
		Page:      page,
		Limit:     limit,
		SortOrder: c.DefaultQuery("sort_order", "asc"),
	}
}

func parseTrialBalanceQuery(c *gin.Context) TrialBalanceQuery {
	includeZeroBalances, _ := strconv.ParseBool(c.DefaultQuery("include_zero_balances", "false"))
	return TrialBalanceQuery{
		BranchID:            c.Query("branch_id"),
		DateFrom:            c.Query("date_from"),
		DateTo:              c.Query("date_to"),
		IncludeZeroBalances: includeZeroBalances,
	}
}

func parseProfitLossQuery(c *gin.Context) ProfitLossQuery {
	return ProfitLossQuery{
		BranchID: c.Query("branch_id"),
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
	}
}

func parseBalanceSheetQuery(c *gin.Context) BalanceSheetQuery {
	return BalanceSheetQuery{
		BranchID: c.Query("branch_id"),
		AsOfDate: c.Query("as_of_date"),
	}
}

func parseReconciliationQuery(c *gin.Context) ReconciliationQuery {
	return ReconciliationQuery{
		BranchID: c.Query("branch_id"),
		AsOfDate: c.Query("as_of_date"),
	}
}

func parseBackfillReadinessQuery(c *gin.Context) BackfillReadinessQuery {
	return BackfillReadinessQuery{
		BranchID: c.Query("branch_id"),
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
	}
}

func validUUIDParam(c *gin.Context, name string) bool {
	if _, err := uuid.Parse(c.Param(name)); err != nil {
		handleError(c, apperrors.BadRequest(name+" must be a valid UUID", nil))
		return false
	}
	return true
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
