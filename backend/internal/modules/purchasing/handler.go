package purchasing

import (
	"errors"
	"io"
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

func (h *Handler) ListOrders(c *gin.Context) {
	result, err := h.service.ListOrders(utils.MustAuthContext(c), parseListQuery(c))
	respond(c, "purchase orders fetched successfully", result, err)
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req CreatePurchaseOrderRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.CreateOrder(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase order created successfully", result, err)
}

func (h *Handler) GetOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetOrder(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase order fetched successfully", result, err)
}

func (h *Handler) UpdateOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdatePurchaseOrderRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateOrder(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase order updated successfully", result, err)
}

func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateOrderStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase order status updated successfully", result, err)
}

func (h *Handler) ReopenOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ReopenOrder(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase order reopened successfully", result, err)
}

func (h *Handler) DuplicateOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.DuplicateOrder(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase order duplicated successfully", result, err)
}

func (h *Handler) DeleteOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	err := h.service.DeleteOrder(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase order deleted successfully", gin.H{"deleted": true, "delete_type": "hard_delete"}, err)
}

func (h *Handler) ConvertOrderToInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req ConvertPurchaseOrderToInvoiceRequest
	if !bindOptionalJSON(c, &req) {
		return
	}
	result, err := h.service.ConvertOrderToInvoice(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase order converted to invoice successfully", result, err)
}

func (h *Handler) ReceiveOrder(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req ReceivePurchaseOrderRequest
	if !bindOptionalJSON(c, &req) {
		return
	}
	result, err := h.service.ReceiveOrder(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase order received successfully", result, err)
}

func (h *Handler) GetOrderDocumentChain(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetDocumentChain(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase document chain fetched successfully", result, err)
}

func (h *Handler) GetDocumentChain(c *gin.Context) {
	purchaseOrderID := c.Query("purchase_order_id")
	if _, err := uuid.Parse(purchaseOrderID); err != nil {
		handleError(c, apperrors.BadRequest("purchase_order_id must be a valid UUID", nil))
		return
	}
	result, err := h.service.GetDocumentChain(utils.MustAuthContext(c), purchaseOrderID, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase document chain fetched successfully", result, err)
}

func (h *Handler) ListInvoices(c *gin.Context) {
	result, err := h.service.ListInvoices(utils.MustAuthContext(c), parseListQuery(c))
	respond(c, "purchase invoices fetched successfully", result, err)
}

func (h *Handler) CreateInvoice(c *gin.Context) {
	var req CreatePurchaseInvoiceRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.CreateInvoice(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase invoice created successfully", result, err)
}

func (h *Handler) GetInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetInvoice(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase invoice fetched successfully", result, err)
}

func (h *Handler) ListInvoicePayments(c *gin.Context) {
	result, err := h.service.ListInvoicePayments(utils.MustAuthContext(c), parsePaymentListQuery(c))
	respond(c, "purchase invoice payments fetched successfully", result, err)
}

func (h *Handler) ListInvoicePaymentsByInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListInvoicePaymentsByInvoice(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase invoice payments fetched successfully", result, err)
}

func (h *Handler) AddInvoicePayment(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req AddPurchaseInvoicePaymentRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.AddInvoicePayment(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase invoice payment added successfully", result, err)
}

func (h *Handler) UpdateInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdatePurchaseInvoiceRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateInvoice(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase invoice updated successfully", result, err)
}

func (h *Handler) PostInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.PostInvoice(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase invoice posted successfully", result, err)
}

func (h *Handler) CancelInvoice(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req CancelPurchaseInvoiceRequest
	if !bindOptionalJSON(c, &req) {
		return
	}
	result, err := h.service.CancelInvoice(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase invoice cancelled successfully", result, err)
}

func (h *Handler) ConvertInvoiceToReceipt(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req ConvertPurchaseInvoiceToReceiptRequest
	if !bindOptionalJSON(c, &req) {
		return
	}
	result, err := h.service.ConvertInvoiceToReceipt(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase invoice converted to receipt successfully", result, err)
}

func (h *Handler) Receive(c *gin.Context) {
	var req ReceivePurchaseRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.Receive(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase received successfully", result, err)
}

func (h *Handler) ListReceipts(c *gin.Context) {
	result, err := h.service.ListReceipts(utils.MustAuthContext(c), parseListQuery(c))
	respond(c, "purchase receipts fetched successfully", result, err)
}

func (h *Handler) GetReceipt(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetReceipt(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase receipt fetched successfully", result, err)
}

func (h *Handler) ReceiptReturnableItems(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ReceiptReturnableItems(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase receipt returnable items fetched successfully", result, err)
}

func (h *Handler) ListReturnsByReceipt(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListReturnsByReceipt(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase receipt returns fetched successfully", result, err)
}

func (h *Handler) PostReceipt(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.PostReceipt(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase receipt posted successfully", result, err)
}

func (h *Handler) CancelReceipt(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.CancelReceipt(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase receipt cancelled successfully", result, err)
}

func (h *Handler) ListReturns(c *gin.Context) {
	result, err := h.service.ListReturns(utils.MustAuthContext(c), parsePurchaseReturnListQuery(c))
	respond(c, "purchase returns fetched successfully", result, err)
}

func (h *Handler) CreateReturn(c *gin.Context) {
	var req CreatePurchaseReturnRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.CreateReturn(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "purchase return created successfully", result, err)
}

func (h *Handler) GetReturn(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetReturn(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "purchase return fetched successfully", result, err)
}

func (h *Handler) UpdateReturn(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdatePurchaseReturnRequest
	if !bindJSON(c, &req) {
		return
	}
	result, err := h.service.UpdateReturn(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase return updated successfully", result, err)
}

func (h *Handler) PostReturn(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.PostReturn(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase return posted successfully", result, err)
}

func (h *Handler) CancelReturn(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.CancelReturn(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "purchase return cancelled successfully", result, err)
}

func (h *Handler) Summary(c *gin.Context) {
	result, err := h.service.Summary(utils.MustAuthContext(c))
	respond(c, "purchasing summary fetched successfully", result, err)
}

func (h *Handler) SupplierHistory(c *gin.Context) {
	if !validParam(c, "supplierId") {
		return
	}
	result, err := h.service.SupplierHistory(utils.MustAuthContext(c), c.Param("supplierId"))
	respond(c, "supplier purchase history fetched successfully", result, err)
}

func parseListQuery(c *gin.Context) ListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return ListQuery{
		Search:        c.Query("search"),
		BranchID:      c.Query("branch_id"),
		SupplierID:    c.Query("supplier_id"),
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		DateFrom:      c.Query("date_from"),
		DateTo:        c.Query("date_to"),
		Page:          page,
		Limit:         limit,
		SortBy:        c.DefaultQuery("sort_by", "created_at"),
		SortOrder:     c.DefaultQuery("sort_order", "desc"),
	}
}

func parsePaymentListQuery(c *gin.Context) PaymentListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return PaymentListQuery{
		Search:          c.Query("search"),
		BranchID:        c.Query("branch_id"),
		SupplierID:      c.Query("supplier_id"),
		InvoiceID:       c.Query("purchase_invoice_id"),
		PaymentMethodID: c.Query("payment_method_id"),
		PaymentStatus:   c.Query("payment_status"),
		PaidByUserID:    c.Query("paid_by_user_id"),
		DateFrom:        c.Query("date_from"),
		DateTo:          c.Query("date_to"),
		Page:            page,
		Limit:           limit,
		SortBy:          c.DefaultQuery("sort_by", "paid_at"),
		SortOrder:       c.DefaultQuery("sort_order", "desc"),
	}
}

func parsePurchaseReturnListQuery(c *gin.Context) PurchaseReturnListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return PurchaseReturnListQuery{
		Search:            c.Query("search"),
		BranchID:          c.Query("branch_id"),
		SupplierID:        c.Query("supplier_id"),
		PurchaseInvoiceID: c.Query("purchase_invoice_id"),
		PurchaseReceiptID: c.Query("purchase_receipt_id"),
		Status:            c.Query("status"),
		DateFrom:          c.Query("date_from"),
		DateTo:            c.Query("date_to"),
		Page:              page,
		Limit:             limit,
		SortBy:            c.DefaultQuery("sort_by", "created_at"),
		SortOrder:         c.DefaultQuery("sort_order", "desc"),
	}
}

func bindJSON(c *gin.Context, target interface{}) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return false
	}
	return true
}

func bindOptionalJSON(c *gin.Context, target interface{}) bool {
	if c.Request.Body == nil || c.Request.ContentLength == 0 {
		return true
	}
	if err := c.ShouldBindJSON(target); err != nil {
		if errors.Is(err, io.EOF) {
			return true
		}
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
