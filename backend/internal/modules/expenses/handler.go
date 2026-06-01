package expenses

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
	response.Success(c, 200, "expenses fetched successfully", result)
}

func (h *Handler) Create(c *gin.Context) {
	var req CreateExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.Create(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "expense created successfully", result)
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
	response.Success(c, 200, "expense fetched successfully", result)
}

func (h *Handler) Update(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.Update(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expense updated successfully", result)
}

func (h *Handler) Delete(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	if err := h.service.Delete(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "expense hard deleted successfully", gin.H{"deleted": true})
}

func parseListQuery(c *gin.Context) ExpenseListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return ExpenseListQuery{
		BranchID:             c.Query("branch_id"),
		ExpenseAccountID:     c.Query("expense_account_id"),
		PaidThroughAccountID: c.Query("paid_through_account_id"),
		SupplierID:           c.Query("supplier_id"),
		CustomerID:           c.Query("customer_id"),
		Status:               c.Query("status"),
		DateFrom:             c.Query("date_from"),
		DateTo:               c.Query("date_to"),
		Search:               c.Query("search"),
		Page:                 page,
		Limit:                limit,
		SortBy:               c.Query("sort_by"),
		SortOrder:            c.Query("sort_order"),
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
