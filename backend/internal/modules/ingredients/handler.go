package ingredients

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

func (h *Handler) List(c *gin.Context) {
	result, err := h.service.List(utils.MustAuthContext(c), parseListQuery(c))
	respond(c, "ingredients fetched successfully", result, err)
}

func (h *Handler) Lookup(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	result, err := h.service.Lookup(utils.MustAuthContext(c), LookupQuery{Search: c.Query("search"), Limit: limit})
	respond(c, "ingredient lookup fetched successfully", result, err)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateIngredientRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.Create(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "ingredient created successfully", result, err)
}

func (h *Handler) Get(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.Get(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "ingredient fetched successfully", result, err)
}

func (h *Handler) Update(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateIngredientRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.Update(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "ingredient updated successfully", result, err)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateStatusRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdateStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "ingredient status updated successfully", result, err)
}

func (h *Handler) Delete(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	err := h.service.Delete(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "ingredient deleted successfully", gin.H{"deleted": true}, err)
}

func parseListQuery(c *gin.Context) ListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	var stockTracked *bool
	if value := c.Query("is_stock_tracked"); value != "" {
		parsed, _ := strconv.ParseBool(value)
		stockTracked = &parsed
	}
	var expiryTracked *bool
	if value := c.Query("is_expiry_tracked"); value != "" {
		parsed, _ := strconv.ParseBool(value)
		expiryTracked = &parsed
	}
	return ListQuery{
		Search:               c.Query("search"),
		IngredientCategoryID: c.Query("ingredient_category_id"),
		SupplierID:           c.Query("supplier_id"),
		Status:               c.Query("status"),
		IsStockTracked:       stockTracked,
		IsExpiryTracked:      expiryTracked,
		Page:                 page,
		Limit:                limit,
		SortBy:               c.DefaultQuery("sort_by", "created_at"),
		SortOrder:            c.DefaultQuery("sort_order", "desc"),
	}
}

func bind(c *gin.Context, target interface{}) bool {
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
