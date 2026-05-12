package recipes

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
	respond(c, "recipes fetched successfully", result, err)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateRecipeRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.Create(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "recipe created successfully", result, err)
}

func (h *Handler) Get(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.Get(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "recipe fetched successfully", result, err)
}

func (h *Handler) Update(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateRecipeRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.Update(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe updated successfully", result, err)
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
	respond(c, "recipe status updated successfully", result, err)
}

func (h *Handler) Delete(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	err := h.service.Delete(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe deleted successfully", gin.H{"deleted": true}, err)
}

func (h *Handler) ListIngredients(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListIngredients(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "recipe ingredients fetched successfully", result, err)
}

func (h *Handler) AddIngredient(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req RecipeIngredientInput
	if !bind(c, &req) {
		return
	}
	result, err := h.service.AddIngredient(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "recipe ingredient added successfully", result, err)
}

func (h *Handler) UpdateIngredient(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "ingredientLineId") {
		return
	}
	var req RecipeIngredientInput
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdateIngredient(utils.MustAuthContext(c), c.Param("id"), c.Param("ingredientLineId"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe ingredient updated successfully", result, err)
}

func (h *Handler) DeleteIngredient(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "ingredientLineId") {
		return
	}
	err := h.service.DeleteIngredient(utils.MustAuthContext(c), c.Param("id"), c.Param("ingredientLineId"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe ingredient deleted successfully", gin.H{"deleted": true}, err)
}

func (h *Handler) ListPackaging(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListPackaging(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "recipe packaging fetched successfully", result, err)
}

func (h *Handler) AddPackaging(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req RecipePackagingInput
	if !bind(c, &req) {
		return
	}
	result, err := h.service.AddPackaging(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "recipe packaging added successfully", result, err)
}

func (h *Handler) UpdatePackaging(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "packagingLineId") {
		return
	}
	var req RecipePackagingInput
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdatePackaging(utils.MustAuthContext(c), c.Param("id"), c.Param("packagingLineId"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe packaging updated successfully", result, err)
}

func (h *Handler) DeletePackaging(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "packagingLineId") {
		return
	}
	err := h.service.DeletePackaging(utils.MustAuthContext(c), c.Param("id"), c.Param("packagingLineId"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe packaging deleted successfully", gin.H{"deleted": true}, err)
}

func (h *Handler) Cost(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.Cost(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "recipe cost fetched successfully", result, err)
}

func (h *Handler) RecalculateCost(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.RecalculateCost(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "recipe cost recalculated successfully", result, err)
}

func (h *Handler) Versions(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.Versions(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "recipe versions fetched successfully", result, err)
}

func (h *Handler) CreateVersion(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req CreateVersionRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.CreateVersion(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "recipe version created successfully", result, err)
}

func (h *Handler) ProductRecipe(c *gin.Context) {
	if !validParam(c, "productId") {
		return
	}
	result, err := h.service.ActiveByProduct(utils.MustAuthContext(c), c.Param("productId"))
	respond(c, "product recipe fetched successfully", result, err)
}

func (h *Handler) Lookup(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	result, err := h.service.Lookup(utils.MustAuthContext(c), c.Query("search"), limit)
	respond(c, "recipe lookup fetched successfully", result, err)
}

func parseListQuery(c *gin.Context) ListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	var active *bool
	if value := c.Query("is_active"); value != "" {
		parsed, _ := strconv.ParseBool(value)
		active = &parsed
	}
	return ListQuery{Search: c.Query("search"), ProductID: c.Query("product_id"), Status: c.Query("status"), IsActive: active, Page: page, Limit: limit, SortBy: c.DefaultQuery("sort_by", "created_at"), SortOrder: c.DefaultQuery("sort_order", "desc")}
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
