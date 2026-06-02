package salesreturns

import (
	"errors"
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

func (h *Handler) List(c *gin.Context) {
	result, err := h.service.List(utils.MustAuthContext(c), parseListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales returns fetched successfully", result)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateSalesReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.Create(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "sales return created successfully", result)
}

func (h *Handler) Get(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.Get(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales return fetched successfully", result)
}

func (h *Handler) Update(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateSalesReturnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.Update(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales return updated successfully", result)
}

func (h *Handler) Post(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.Post(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales return posted successfully", result)
}

func (h *Handler) Cancel(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.Cancel(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sales return cancelled successfully", result)
}

func (h *Handler) ReturnableItems(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ReturnableItems(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "returnable sale items fetched successfully", result)
}

func (h *Handler) ListBySale(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ListBySale(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "sale returns fetched successfully", result)
}

func parseListQuery(c *gin.Context) SalesReturnListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return SalesReturnListQuery{
		Search:     c.Query("search"),
		SaleID:     c.Query("sale_id"),
		BranchID:   c.Query("branch_id"),
		CustomerID: c.Query("customer_id"),
		Status:     c.Query("status"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
		Page:       page,
		Limit:      limit,
		SortOrder:  c.Query("sort_order"),
	}
}

func validUUIDParam(c *gin.Context, name string) bool {
	if _, err := uuid.Parse(c.Param(name)); err != nil {
		response.Error(c, 400, "invalid "+name, nil)
		return false
	}
	return true
}

func handleError(c *gin.Context, err error) {
	var appErr *apperrors.AppError
	if errors.As(err, &appErr) {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, err.Error(), nil)
}
