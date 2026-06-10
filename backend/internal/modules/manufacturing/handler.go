package manufacturing

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

func (h *Handler) ListBatches(c *gin.Context) {
	result, err := h.service.ListBatches(utils.MustAuthContext(c), parseBatchListQuery(c))
	respond(c, "production batches fetched successfully", result, err)
}

func (h *Handler) ListProductions(c *gin.Context) {
	result, err := h.service.ListProductions(utils.MustAuthContext(c), parseBatchListQuery(c))
	respond(c, "productions fetched successfully", result, err)
}

func (h *Handler) CreateProduction(c *gin.Context) {
	var req CreateProductionRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.CreateProduction(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "production created successfully", result, err)
}

func (h *Handler) GetProduction(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetProduction(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production fetched successfully", result, err)
}

func (h *Handler) ProductionPreview(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	quantity, _ := strconv.ParseFloat(c.Query("quantity"), 64)
	result, err := h.service.ProductionPreview(utils.MustAuthContext(c), c.Param("id"), c.Query("branch_id"), quantity)
	respond(c, "production preview fetched successfully", result, err)
}

func (h *Handler) CreateBatch(c *gin.Context) {
	var req CreateBatchRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.CreateBatch(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	respondCreated(c, "production batch created successfully", result, err)
}

func (h *Handler) GetBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetBatch(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production batch fetched successfully", result, err)
}

func (h *Handler) UpdateBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req UpdateBatchRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdateBatch(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production batch updated successfully", result, err)
}

func (h *Handler) StartBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.StartBatch(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "production batch started successfully", result, err)
}

func (h *Handler) CompleteBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req CompleteBatchRequest
	if c.Request.ContentLength != 0 && !bind(c, &req) {
		return
	}
	result, err := h.service.CompleteBatch(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production completed successfully", result, err)
}

func (h *Handler) ProduceBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req ProduceBatchRequest
	if c.Request.ContentLength != 0 && !bind(c, &req) {
		return
	}
	result, err := h.service.ProduceBatch(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production output saved successfully", result, err)
}

func (h *Handler) RecordWastage(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req WastageBatchRequest
	if c.Request.ContentLength != 0 && !bind(c, &req) {
		return
	}
	result, err := h.service.RecordWastage(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production wastage saved successfully", result, err)
}

func (h *Handler) GetOutputs(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetOutputs(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production outputs fetched successfully", result, err)
}

func (h *Handler) GetWastage(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.GetWastage(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production wastage fetched successfully", result, err)
}

func (h *Handler) CancelBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	var req CancelBatchRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.CancelBatch(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production batch cancelled successfully", result, err)
}

func (h *Handler) DeleteBatch(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	err := h.service.DeleteBatch(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	respond(c, "production batch deleted successfully", nil, err)
}

func (h *Handler) ListIngredients(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListIngredients(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production ingredients fetched successfully", result, err)
}

func (h *Handler) UpdateIngredient(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "lineId") {
		return
	}
	var req UpdateIngredientRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdateIngredient(utils.MustAuthContext(c), c.Param("id"), c.Param("lineId"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production ingredient updated successfully", result, err)
}

func (h *Handler) ListPackaging(c *gin.Context) {
	if !validParam(c, "id") {
		return
	}
	result, err := h.service.ListPackaging(utils.MustAuthContext(c), c.Param("id"))
	respond(c, "production packaging fetched successfully", result, err)
}

func (h *Handler) UpdatePackaging(c *gin.Context) {
	if !validParam(c, "id") || !validParam(c, "lineId") {
		return
	}
	var req UpdatePackagingRequest
	if !bind(c, &req) {
		return
	}
	result, err := h.service.UpdatePackaging(utils.MustAuthContext(c), c.Param("id"), c.Param("lineId"), req, c.ClientIP(), c.Request.UserAgent())
	respond(c, "production packaging updated successfully", result, err)
}

func (h *Handler) Summary(c *gin.Context) {
	result, err := h.service.Summary(utils.MustAuthContext(c), parseBatchListQuery(c))
	respond(c, "manufacturing summary fetched successfully", result, err)
}

func (h *Handler) ProductHistory(c *gin.Context) {
	if !validParam(c, "productId") {
		return
	}
	result, err := h.service.ProductHistory(utils.MustAuthContext(c), c.Param("productId"))
	respond(c, "product manufacturing history fetched successfully", result, err)
}

func parseBatchListQuery(c *gin.Context) BatchListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return BatchListQuery{Search: c.Query("search"), BranchID: c.Query("branch_id"), ProductID: c.Query("product_id"), RecipeID: c.Query("recipe_id"), Status: c.Query("status"), DateFrom: c.Query("date_from"), DateTo: c.Query("date_to"), Page: page, Limit: limit, SortBy: c.DefaultQuery("sort_by", "created_at"), SortOrder: c.DefaultQuery("sort_order", "desc")}
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
