package inventory

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

func (h *Handler) ListInventory(c *gin.Context) {
	result, err := h.service.ListInventory(utils.MustAuthContext(c), parseInventoryListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory fetched successfully", result)
}

func (h *Handler) GetInventoryItem(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetInventoryItem(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory item fetched successfully", result)
}

func (h *Handler) CreateOpeningStock(c *gin.Context) {
	var req OpeningStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateOpeningStock(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "opening stock created successfully", result)
}

func (h *Handler) AdjustStock(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req AdjustStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.AdjustStock(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory adjusted successfully", result)
}

func (h *Handler) ListMovements(c *gin.Context) {
	result, err := h.service.ListMovements(utils.MustAuthContext(c), "", parseMovementListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "stock movements fetched successfully", result)
}

func (h *Handler) ListStockMovements(c *gin.Context) {
	result, err := h.service.ListMovements(utils.MustAuthContext(c), "", parseMovementListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "stock movements fetched successfully", result)
}

func (h *Handler) GetStockMovement(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetStockMovement(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "stock movement fetched successfully", result)
}

func (h *Handler) ListStockMovementsByInventory(c *gin.Context) {
	if !validUUIDParam(c, "inventoryItemId") {
		return
	}
	result, err := h.service.ListMovements(utils.MustAuthContext(c), c.Param("inventoryItemId"), parseMovementListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory stock movements fetched successfully", result)
}

func (h *Handler) CreateManualStockMovement(c *gin.Context) {
	var req ManualStockMovementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.ManualStockMovement(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "stock movement created successfully", result)
}

func (h *Handler) ReverseStockMovement(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req ReverseStockMovementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.ReverseStockMovement(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "stock movement reversed successfully", result)
}

func (h *Handler) StockMovementSummary(c *gin.Context) {
	result, err := h.service.StockMovementSummary(utils.MustAuthContext(c), parseMovementListQuery(c), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "stock movement summary fetched successfully", result)
}

func (h *Handler) InventoryLedgerAudit(c *gin.Context) {
	if !validUUIDParam(c, "inventoryItemId") {
		return
	}
	result, err := h.service.InventoryLedgerAudit(utils.MustAuthContext(c), c.Param("inventoryItemId"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory ledger audit fetched successfully", result)
}

func (h *Handler) ListItemMovements(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ListMovements(utils.MustAuthContext(c), c.Param("id"), parseMovementListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "inventory item movements fetched successfully", result)
}

func (h *Handler) LowStock(c *gin.Context) {
	result, err := h.service.LowStock(utils.MustAuthContext(c), c.Query("branch_id"), c.Query("item_type"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "low stock inventory fetched successfully", result)
}

func (h *Handler) ExpiryAlerts(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	result, err := h.service.ExpiryAlerts(utils.MustAuthContext(c), c.Query("branch_id"), days)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expiry alerts fetched successfully", result)
}

func (h *Handler) ListExpiryBatches(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ListExpiryBatches(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expiry batches fetched successfully", result)
}

func (h *Handler) CreateExpiryBatch(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req ExpiryBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateExpiryBatch(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "expiry batch created successfully", result)
}

func (h *Handler) UpdateExpiryBatch(c *gin.Context) {
	if !validUUIDParam(c, "batchId") {
		return
	}
	var req UpdateExpiryBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateExpiryBatch(utils.MustAuthContext(c), c.Param("batchId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expiry batch updated successfully", result)
}

func (h *Handler) UpdateExpiryBatchStatus(c *gin.Context) {
	if !validUUIDParam(c, "batchId") {
		return
	}
	var req UpdateExpiryBatchStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateExpiryBatchStatus(utils.MustAuthContext(c), c.Param("batchId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expiry batch status updated successfully", result)
}

func parseInventoryListQuery(c *gin.Context) InventoryListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	var expiryTracked *bool
	if value := c.Query("expiry_tracked"); value != "" {
		parsed, _ := strconv.ParseBool(value)
		expiryTracked = &parsed
	}
	lowStockOnly, _ := strconv.ParseBool(c.DefaultQuery("low_stock_only", "false"))
	return InventoryListQuery{
		Search:        c.Query("search"),
		BranchID:      c.Query("branch_id"),
		ItemType:      c.Query("item_type"),
		Status:        c.Query("status"),
		LowStockOnly:  lowStockOnly,
		ExpiryTracked: expiryTracked,
		Page:          page,
		Limit:         limit,
		SortBy:        c.DefaultQuery("sort_by", "created_at"),
		SortOrder:     c.DefaultQuery("sort_order", "desc"),
	}
}

func parseMovementListQuery(c *gin.Context) MovementListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return MovementListQuery{
		Search:            c.Query("search"),
		BranchID:          c.Query("branch_id"),
		InventoryItemID:   c.Query("inventory_item_id"),
		ItemType:          c.Query("item_type"),
		MovementType:      c.Query("movement_type"),
		MovementDirection: c.Query("movement_direction"),
		ReferenceType:     c.Query("reference_type"),
		ReferenceID:       c.Query("reference_id"),
		DateFrom:          c.Query("date_from"),
		DateTo:            c.Query("date_to"),
		CreatedByUserID:   c.Query("created_by_user_id"),
		Page:              page,
		Limit:             limit,
		SortBy:            c.DefaultQuery("sort_by", "created_at"),
		SortOrder:         c.DefaultQuery("sort_order", "desc"),
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
