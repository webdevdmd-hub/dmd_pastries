package payments

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

func (h *Handler) ListPayments(c *gin.Context) {
	result, err := h.service.ListPayments(utils.MustAuthContext(c), parsePaymentListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payments fetched successfully", result)
}

func (h *Handler) GetPayment(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetPayment(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment fetched successfully", result)
}

func (h *Handler) SalePayments(c *gin.Context) {
	if !validUUIDParam(c, "saleId") {
		return
	}
	result, err := h.service.SalePayments(utils.MustAuthContext(c), c.Param("saleId"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sale payments fetched successfully", result)
}

func (h *Handler) AddPayment(c *gin.Context) {
	if !validUUIDParam(c, "saleId") {
		return
	}
	var req AddPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.AddPayment(utils.MustAuthContext(c), c.Param("saleId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment added successfully", result)
}

func (h *Handler) RefundPayment(c *gin.Context) {
	if !validUUIDParam(c, "paymentId") {
		return
	}
	var req RefundPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.RefundPayment(utils.MustAuthContext(c), c.Param("paymentId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment refunded successfully", result)
}

func (h *Handler) ListRefunds(c *gin.Context) {
	result, err := h.service.ListRefunds(utils.MustAuthContext(c), parseRefundListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment refunds fetched successfully", result)
}

func (h *Handler) GetRefund(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetRefund(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment refund fetched successfully", result)
}

func (h *Handler) DailySummary(c *gin.Context) {
	result, err := h.service.DailySummary(utils.MustAuthContext(c), c.Query("date"), c.Query("branch_id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "daily payment summary fetched successfully", result)
}

func (h *Handler) MethodSummary(c *gin.Context) {
	result, err := h.service.MethodSummary(utils.MustAuthContext(c), c.Query("date_from"), c.Query("date_to"), c.Query("branch_id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment method summary fetched successfully", result)
}

func (h *Handler) CreateReconciliation(c *gin.Context) {
	var req CreateReconciliationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateReconciliation(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment reconciliation created successfully", result)
}

func (h *Handler) ListReconciliations(c *gin.Context) {
	result, err := h.service.ListReconciliations(utils.MustAuthContext(c), parseReconciliationListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment reconciliations fetched successfully", result)
}

func (h *Handler) GetReconciliation(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetReconciliation(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment reconciliation fetched successfully", result)
}

func parsePaymentListQuery(c *gin.Context) PaymentListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return PaymentListQuery{
		Search:          c.Query("search"),
		SaleID:          c.Query("sale_id"),
		BakeryOrderID:   c.Query("bakery_order_id"),
		SourceType:      c.Query("source_type"),
		SourceID:        c.Query("source_id"),
		PaymentMethodID: c.Query("payment_method_id"),
		PaymentStatus:   c.Query("payment_status"),
		BranchID:        c.Query("branch_id"),
		PaidByUserID:    c.Query("paid_by_user_id"),
		DateFrom:        c.Query("date_from"),
		DateTo:          c.Query("date_to"),
		Page:            page,
		Limit:           limit,
		SortBy:          c.DefaultQuery("sort_by", "paid_at"),
		SortOrder:       c.DefaultQuery("sort_order", "desc"),
	}
}

func parseRefundListQuery(c *gin.Context) RefundListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return RefundListQuery{SaleID: c.Query("sale_id"), PaymentMethodID: c.Query("payment_method_id"), RefundStatus: c.Query("refund_status"), BranchID: c.Query("branch_id"), DateFrom: c.Query("date_from"), DateTo: c.Query("date_to"), Page: page, Limit: limit}
}

func parseReconciliationListQuery(c *gin.Context) ReconciliationListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return ReconciliationListQuery{BranchID: c.Query("branch_id"), PaymentMethodID: c.Query("payment_method_id"), DateFrom: c.Query("date_from"), DateTo: c.Query("date_to"), Status: c.Query("status"), Page: page, Limit: limit}
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
