package masterdata

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

func (h *Handler) Overview(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	overview, err := h.service.Overview(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "master data overview fetched successfully", overview)
}

func (h *Handler) CopyCategories(c *gin.Context) {
	var req CopyCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.CopyCategories(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "categories copied successfully", result)
}

func (h *Handler) ListUnitCategories(c *gin.Context) {
	categories, err := h.service.ListUnitCategories()
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "unit categories fetched successfully", categories)
}

func (h *Handler) ListUnits(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	units, err := h.service.ListUnits(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "units fetched successfully", units)
}

func (h *Handler) CreateUnit(c *gin.Context) {
	var req CreateUnitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	unit, err := h.service.CreateUnit(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "unit created successfully", unit)
}

func (h *Handler) GetUnit(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	unit, err := h.service.GetUnit(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "unit fetched successfully", unit)
}

func (h *Handler) UpdateUnit(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateUnitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	unit, err := h.service.UpdateUnit(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "unit updated successfully", unit)
}

func (h *Handler) UpdateUnitStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	unit, err := h.service.UpdateUnitStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "unit status updated successfully", unit)
}

func (h *Handler) DeleteUnit(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteUnit(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "unit deactivated successfully", gin.H{"deactivated": true})
}

func (h *Handler) ListOrderStatuses(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	statuses, err := h.service.ListOrderStatuses(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "order statuses fetched successfully", statuses)
}

func (h *Handler) CreateOrderStatus(c *gin.Context) {
	var req CreateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.CreateOrderStatus(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "order status created successfully", status)
}

func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.UpdateOrderStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "order status updated successfully", status)
}

func (h *Handler) UpdateOrderStatusStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.UpdateOrderStatusStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "order status state updated successfully", status)
}

func (h *Handler) ListPaymentStatuses(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	statuses, err := h.service.ListPaymentStatuses(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment statuses fetched successfully", statuses)
}

func (h *Handler) CreatePaymentStatus(c *gin.Context) {
	var req CreatePaymentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.CreatePaymentStatus(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "payment status created successfully", status)
}

func (h *Handler) UpdatePaymentStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdatePaymentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.UpdatePaymentStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment status updated successfully", status)
}

func (h *Handler) UpdatePaymentStatusStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.UpdatePaymentStatusStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "payment status state updated successfully", status)
}

func (h *Handler) ListProductCategories(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	categories, err := h.service.ListProductCategories(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product categories fetched successfully", categories)
}

func (h *Handler) CreateProductCategory(c *gin.Context) {
	var req CreateProductCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.CreateProductCategory(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "product category created successfully", category)
}

func (h *Handler) GetProductCategory(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.GetProductCategory(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product category fetched successfully", category)
}

func (h *Handler) UpdateProductCategory(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateProductCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.UpdateProductCategory(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product category updated successfully", category)
}

func (h *Handler) UpdateProductCategoryStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.UpdateProductCategoryStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product category status updated successfully", category)
}

func (h *Handler) DeleteProductCategory(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteProductCategory(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product category deactivated successfully", gin.H{"deactivated": true})
}

func (h *Handler) listSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	currentUser := utils.MustAuthContext(c)
	categories, err := h.service.ListSimpleCategories(currentUser, cfg)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, categories)
}

func (h *Handler) createSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	var req CreateSimpleCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.CreateSimpleCategory(currentUser, cfg, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, message, category)
}

func (h *Handler) getSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.GetSimpleCategory(currentUser, cfg, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, category)
}

func (h *Handler) updateSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateSimpleCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.UpdateSimpleCategory(currentUser, cfg, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, category)
}

func (h *Handler) statusSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	category, err := h.service.UpdateSimpleCategoryStatus(currentUser, cfg, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, category)
}

func (h *Handler) deleteSimple(c *gin.Context, cfg simpleCategoryConfig, message string) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteSimpleCategory(currentUser, cfg, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, message, gin.H{"deactivated": true})
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
