package pos

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

func (h *Handler) ListProducts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ListPOSProducts(currentUser, parsePOSProductQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "POS products fetched successfully", result)
}

func (h *Handler) LookupProduct(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.LookupProduct(currentUser, c.Query("barcode"), c.Query("sku"), c.Query("product_code"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "POS product lookup fetched successfully", result)
}

func (h *Handler) ListPaymentMethods(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ListPaymentMethods(currentUser, c.Query("branch_id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "POS payment methods fetched successfully", result)
}

func (h *Handler) ReferenceData(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ReferenceData(currentUser, c.Query("branch_id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "POS reference data fetched successfully", result)
}

func (h *Handler) Checkout(c *gin.Context) {
	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.Checkout(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "sale completed successfully", result)
}

func (h *Handler) CreateHeldSale(c *gin.Context) {
	var req HoldSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.CreateHeldSale(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "sale held successfully", result)
}

func (h *Handler) ListHeldSales(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ListHeldSales(currentUser, parseHeldSalesListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "held sales fetched successfully", result)
}

func (h *Handler) GetHeldSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.GetHeldSale(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "held sale fetched successfully", result)
}

func (h *Handler) ResumeHeldSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ResumeHeldSale(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "held sale resumed successfully", result)
}

func (h *Handler) CancelHeldSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.CancelHeldSale(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "held sale cancelled successfully", gin.H{"cancelled": true})
}

func (h *Handler) ListSales(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ListSales(currentUser, parseSalesListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales fetched successfully", result)
}

func (h *Handler) GetSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.GetSale(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sale fetched successfully", result)
}

func (h *Handler) GetReceipt(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.GetReceipt(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt fetched successfully", result)
}

func (h *Handler) RefundSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req RefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.RefundSale(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sale refunded successfully", result)
}

func (h *Handler) VoidSale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req VoidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.VoidSale(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sale voided successfully", result)
}

func parsePOSProductQuery(c *gin.Context) POSProductQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return POSProductQuery{
		Search:        c.Query("search"),
		CategoryID:    c.Query("category_id"),
		ProductType:   c.Query("product_type"),
		ItemStructure: c.Query("item_structure"),
		Page:          page,
		Limit:         limit,
	}
}

func parseSalesListQuery(c *gin.Context) SalesListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return SalesListQuery{
		Search:              c.Query("search"),
		BranchID:            c.Query("branch_id"),
		SaleStatus:          c.Query("sale_status"),
		PaymentStatus:       c.Query("payment_status"),
		CashierUserID:       c.Query("cashier_user_id"),
		CustomerID:          c.Query("customer_id"),
		SalesChannelID:      c.Query("sales_channel_id"),
		ExternalOrderNumber: c.Query("external_order_number"),
		DateFrom:            c.Query("date_from"),
		DateTo:              c.Query("date_to"),
		Page:                page,
		Limit:               limit,
		SortBy:              c.DefaultQuery("sort_by", "sold_at"),
		SortOrder:           c.DefaultQuery("sort_order", "desc"),
	}
}

func parseHeldSalesListQuery(c *gin.Context) HeldSalesListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return HeldSalesListQuery{
		Search:        c.Query("search"),
		BranchID:      c.Query("branch_id"),
		CashierUserID: c.Query("cashier_user_id"),
		Status:        c.Query("status"),
		Page:          page,
		Limit:         limit,
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
