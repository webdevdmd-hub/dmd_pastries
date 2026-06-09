package products

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
	result, err := h.service.ListProducts(currentUser, parseListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "products fetched successfully", result)
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	product, err := h.service.CreateProduct(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "product created successfully", product)
}

func (h *Handler) GetProduct(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	product, err := h.service.GetProduct(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product fetched successfully", product)
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	product, err := h.service.UpdateProduct(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product updated successfully", product)
}

func (h *Handler) UpdateProductStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateProductStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	product, err := h.service.UpdateProductStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product status updated successfully", product)
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteProduct(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) POSProducts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	products, err := h.service.POSProducts(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "POS products fetched successfully", products)
}

func (h *Handler) LookupProduct(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.LookupProduct(currentUser, c.Query("barcode"), c.Query("sku"), c.Query("product_code"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "product lookup fetched successfully", result)
}

func parseListQuery(c *gin.Context) ProductListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return ProductListQuery{
		Search:         c.Query("search"),
		CategoryID:     c.Query("category_id"),
		ProductType:    c.Query("product_type"),
		ItemStructure:  c.Query("item_structure"),
		Status:         c.Query("status"),
		IsPOSVisible:   parseBoolPointer(c.Query("is_pos_visible")),
		IsStockTracked: parseBoolPointer(c.Query("is_stock_tracked")),
		Page:           page,
		Limit:          limit,
		SortBy:         c.DefaultQuery("sort_by", "created_at"),
		SortOrder:      c.DefaultQuery("sort_order", "desc"),
	}
}

func parseBoolPointer(value string) *bool {
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return nil
	}
	return &parsed
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
