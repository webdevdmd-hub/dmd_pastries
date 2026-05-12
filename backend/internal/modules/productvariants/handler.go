package productvariants

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

func (h *Handler) ListVariants(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	variants, err := h.service.ListVariants(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product variants fetched successfully", variants)
}

func (h *Handler) CreateVariant(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req CreateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	variant, err := h.service.CreateVariant(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "product variant created successfully", variant)
}

func (h *Handler) UpdateVariant(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "variantId") {
		return
	}
	var req UpdateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	variant, err := h.service.UpdateVariant(currentUser, c.Param("id"), c.Param("variantId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product variant updated successfully", variant)
}

func (h *Handler) UpdateVariantStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "variantId") {
		return
	}
	var req UpdateVariantStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	variant, err := h.service.UpdateVariantStatus(currentUser, c.Param("id"), c.Param("variantId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product variant status updated successfully", variant)
}

func (h *Handler) DeleteVariant(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "variantId") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteVariant(currentUser, c.Param("id"), c.Param("variantId"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product variant deleted successfully", gin.H{"deleted": true})
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
