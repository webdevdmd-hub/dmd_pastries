package bakeryorders

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

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func (h *Handler) ListOrders(c *gin.Context) {
	result, err := h.service.ListOrders(utils.MustAuthContext(c), parseListQuery(c))
	respond(c, "bakery orders fetched successfully", result, err)
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.CreateOrder(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order created successfully", result, err)
}

func (h *Handler) GetOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetOrder(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "bakery order fetched successfully", result, err)
}

func (h *Handler) UpdateOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateOrderRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateOrder(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order updated successfully", result, err)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order status updated successfully", result, err)
}

func (h *Handler) DeleteOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	err := h.service.DeleteOrder(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order deleted successfully", gin.H{"deleted": true}, err)
}

func (h *Handler) AddItem(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req OrderItemRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.AddItem(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order item added successfully", result, err)
}

func (h *Handler) UpdateItem(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "itemId") {
		return
	}
	var req OrderItemRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateItem(utils.MustAuthContext(c), c.Param("id"), c.Param("itemId"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order item updated successfully", result, err)
}

func (h *Handler) DeleteItem(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "itemId") {
		return
	}
	result, err := h.service.DeleteItem(utils.MustAuthContext(c), c.Param("id"), c.Param("itemId"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order item deleted successfully", result, err)
}

func (h *Handler) ConvertItemToProduct(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "itemId") {
		return
	}
	var req ConvertItemToProductRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.ConvertItemToProduct(utils.MustAuthContext(c), c.Param("id"), c.Param("itemId"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order item converted to product successfully", result, err)
}

func (h *Handler) ConvertItemToVariant(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "itemId") {
		return
	}
	var req ConvertItemToVariantRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.ConvertItemToVariant(utils.MustAuthContext(c), c.Param("id"), c.Param("itemId"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order item converted to variant successfully", result, err)
}

func (h *Handler) ListPayments(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListPayments(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "bakery order payments fetched successfully", result, err)
}

func (h *Handler) AddPayment(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req AddPaymentRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.AddPayment(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order payment added successfully", result, err)
}

func (h *Handler) AssignProduction(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req AssignProductionRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.AssignProduction(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order production assigned successfully", result, err)
}

func (h *Handler) CreateProductionFromItem(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "itemId") {
		return
	}
	var req CreateProductionFromItemRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.CreateProductionFromItem(utils.MustAuthContext(c), c.Param("id"), c.Param("itemId"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "production batch created from bakery order item successfully", result, err)
}

func (h *Handler) UpdateProductionStatus(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateProductionStatusRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateProductionStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "bakery order production status updated successfully", result, err)
}

func (h *Handler) ListPackaging(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListPackaging(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "bakery order packaging fetched successfully", result, err)
}

func (h *Handler) AddPackaging(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req AddPackagingRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.AddPackaging(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "bakery order packaging assigned successfully", result, err)
}

func (h *Handler) Summary(c *gin.Context) {
	result, err := h.service.Summary(utils.MustAuthContext(c))
	respond(c, "bakery orders summary fetched successfully", result, err)
}

func parseListQuery(c *gin.Context) OrderListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return OrderListQuery{Search: c.Query("search"), BranchID: c.Query("branch_id"), CustomerID: c.Query("customer_id"), SalesChannelID: c.Query("sales_channel_id"), ExternalOrderNumber: c.Query("external_order_number"), OrderType: c.Query("order_type"), OrderStatus: c.Query("order_status"), PaymentStatus: c.Query("payment_status"), DateFrom: c.Query("date_from"), DateTo: c.Query("date_to"), Page: page, Limit: limit, SortBy: c.DefaultQuery("sort_by", "created_at"), SortOrder: c.DefaultQuery("sort_order", "desc")}
}

func bindJSON(c *gin.Context, target interface{}) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return false
	}
	return true
}

func validParam(c *gin.Context, name string) bool {
	if _, err := uuid.Parse(c.Param(name)); err != nil {
		handleError(c, apperrors.BadRequest(name+" must be a valid UUID", nil))
		return false
	}
	return true
}

func respond(c *gin.Context, message string, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, data)
}

func respondCreated(c *gin.Context, message string, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, message, data)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
