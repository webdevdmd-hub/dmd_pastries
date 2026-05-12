package customers

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

func (h *Handler) ListCustomers(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	result, err := h.service.ListCustomers(currentUser, parseCustomerListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customers fetched successfully", result)
}

func (h *Handler) LookupCustomers(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	result, err := h.service.LookupCustomers(currentUser, CustomerLookupQuery{
		Search: c.Query("search"),
		Phone:  c.Query("phone"),
		Email:  c.Query("email"),
		Limit:  limit,
	})
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customers lookup fetched successfully", result)
}

func (h *Handler) CreateCustomer(c *gin.Context) {
	var req CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	customer, err := h.service.CreateCustomer(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "customer created successfully", customer)
}

func (h *Handler) QuickCreateCustomer(c *gin.Context) {
	var req QuickCreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	customer, err := h.service.QuickCreateCustomer(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "customer quick-created successfully", customer)
}

func (h *Handler) GetCustomer(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	customer, err := h.service.GetCustomer(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer fetched successfully", customer)
}

func (h *Handler) UpdateCustomer(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	customer, err := h.service.UpdateCustomer(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer updated successfully", customer)
}

func (h *Handler) UpdateCustomerStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateCustomerStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	customer, err := h.service.UpdateCustomerStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer status updated successfully", customer)
}

func (h *Handler) DeleteCustomer(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteCustomer(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListTags(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	tags, err := h.service.ListTags(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer tags fetched successfully", tags)
}

func (h *Handler) CreateTag(c *gin.Context) {
	var req CreateCustomerTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	tag, err := h.service.CreateTag(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "customer tag created successfully", tag)
}

func (h *Handler) UpdateTag(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateCustomerTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	tag, err := h.service.UpdateTag(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer tag updated successfully", tag)
}

func (h *Handler) DeleteTag(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteTag(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer tag deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListCustomerTags(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	tags, err := h.service.ListCustomerTags(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer tags fetched successfully", tags)
}

func (h *Handler) AttachTag(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req AssignCustomerTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	tags, err := h.service.AttachTag(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "customer tag attached successfully", tags)
}

func (h *Handler) RemoveTag(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "tagId") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.RemoveTag(currentUser, c.Param("id"), c.Param("tagId"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer tag removed successfully", gin.H{"removed": true})
}

func (h *Handler) ListNotes(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	notes, err := h.service.ListNotes(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer notes fetched successfully", notes)
}

func (h *Handler) AddNote(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req CreateCustomerNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	currentUser := utils.MustAuthContext(c)
	note, err := h.service.AddNote(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "customer note added successfully", note)
}

func (h *Handler) DeleteNote(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "noteId") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteNote(currentUser, c.Param("id"), c.Param("noteId"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer note deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) Stats(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	currentUser := utils.MustAuthContext(c)
	stats, err := h.service.Stats(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "customer stats fetched successfully", stats)
}

func parseCustomerListQuery(c *gin.Context) CustomerListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return CustomerListQuery{
		Search:    c.Query("search"),
		Phone:     c.Query("phone"),
		Email:     c.Query("email"),
		Status:    c.Query("status"),
		TagID:     c.Query("tag_id"),
		DateFrom:  c.Query("date_from"),
		DateTo:    c.Query("date_to"),
		Page:      page,
		Limit:     limit,
		SortBy:    c.DefaultQuery("sort_by", "created_at"),
		SortOrder: c.DefaultQuery("sort_order", "desc"),
	}
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
