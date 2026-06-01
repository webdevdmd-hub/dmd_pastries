package settings

import (
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

func (h *Handler) GetCompanySettings(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	settings, err := h.service.GetCompanySettings(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "company settings fetched successfully", settings)
}

func (h *Handler) UpdateCompanySettings(c *gin.Context) {
	var req UpdateCompanySettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	settings, err := h.service.UpdateCompanySettings(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "company settings updated successfully", settings)
}

func (h *Handler) GetOverview(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	overview, err := h.service.GetOverview(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "settings overview fetched successfully", overview)
}

func (h *Handler) ListTaxRates(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	taxRates, err := h.service.ListTaxRates(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "tax rates fetched successfully", taxRates)
}

func (h *Handler) CreateTaxRate(c *gin.Context) {
	var req CreateTaxRateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	taxRate, err := h.service.CreateTaxRate(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "tax rate created successfully", taxRate)
}

func (h *Handler) GetTaxRate(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	taxRate, err := h.service.GetTaxRate(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "tax rate fetched successfully", taxRate)
}

func (h *Handler) UpdateTaxRate(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateTaxRateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	taxRate, err := h.service.UpdateTaxRate(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "tax rate updated successfully", taxRate)
}

func (h *Handler) UpdateTaxRateStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	taxRate, err := h.service.UpdateTaxRateStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "tax rate status updated successfully", taxRate)
}

func (h *Handler) DeleteTaxRate(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteTaxRate(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "tax rate deactivated successfully", gin.H{"deactivated": true})
}

func (h *Handler) ListPaymentMethods(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	methods, err := h.service.ListPaymentMethods(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment methods fetched successfully", methods)
}

func (h *Handler) CreatePaymentMethod(c *gin.Context) {
	var req CreatePaymentMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	method, err := h.service.CreatePaymentMethod(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment method created successfully", method)
}

func (h *Handler) GetPaymentMethod(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	method, err := h.service.GetPaymentMethod(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment method fetched successfully", method)
}

func (h *Handler) UpdatePaymentMethod(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdatePaymentMethodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	method, err := h.service.UpdatePaymentMethod(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment method updated successfully", method)
}

func (h *Handler) UpdatePaymentMethodStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	method, err := h.service.UpdatePaymentMethodStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment method status updated successfully", method)
}

func (h *Handler) DeletePaymentMethod(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeletePaymentMethod(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment method deactivated successfully", gin.H{"deactivated": true})
}

func (h *Handler) ListSalesChannels(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	channels, err := h.service.ListSalesChannels(currentUser, c.Query("channel_type"), c.Query("status"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales channels fetched successfully", channels)
}

func (h *Handler) CreateSalesChannel(c *gin.Context) {
	var req CreateSalesChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	channel, err := h.service.CreateSalesChannel(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "sales channel created successfully", channel)
}

func (h *Handler) GetSalesChannel(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	channel, err := h.service.GetSalesChannel(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales channel fetched successfully", channel)
}

func (h *Handler) UpdateSalesChannel(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateSalesChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	channel, err := h.service.UpdateSalesChannel(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales channel updated successfully", channel)
}

func (h *Handler) UpdateSalesChannelStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	channel, err := h.service.UpdateSalesChannelStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales channel status updated successfully", channel)
}

func (h *Handler) SetDefaultSalesChannel(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	channel, err := h.service.SetDefaultSalesChannel(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "default sales channel updated successfully", channel)
}

func (h *Handler) DeleteSalesChannel(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteSalesChannel(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales channel deactivated successfully", gin.H{"deactivated": true})
}

func (h *Handler) ListReceiptLayouts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	layouts, err := h.service.ListReceiptLayouts(currentUser, c.Query("branch_id"), c.Query("receipt_type"), c.Query("status"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt layouts fetched successfully", layouts)
}

func (h *Handler) CreateReceiptLayout(c *gin.Context) {
	var req CreateReceiptLayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	layout, err := h.service.CreateReceiptLayout(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "receipt layout created successfully", layout)
}

func (h *Handler) GetReceiptLayout(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	layout, err := h.service.GetReceiptLayout(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt layout fetched successfully", layout)
}

func (h *Handler) UpdateReceiptLayout(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateReceiptLayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	layout, err := h.service.UpdateReceiptLayout(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt layout updated successfully", layout)
}

func (h *Handler) DeleteReceiptLayout(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteReceiptLayout(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt layout deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) SetDefaultReceiptLayout(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	layout, err := h.service.SetDefaultReceiptLayout(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "default receipt layout updated successfully", layout)
}

func (h *Handler) PreviewReceiptLayout(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req ReceiptLayoutPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	preview, err := h.service.PreviewReceiptLayout(currentUser, c.Param("id"), req)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "receipt layout preview generated successfully", preview)
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
