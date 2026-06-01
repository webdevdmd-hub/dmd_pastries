package suppliers

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

func (h *Handler) ListSuppliers(c *gin.Context) {
	result, err := h.service.ListSuppliers(utils.MustAuthContext(c), parseSupplierListQuery(c))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "suppliers fetched successfully", result)
}

func (h *Handler) LookupSuppliers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	result, err := h.service.LookupSuppliers(utils.MustAuthContext(c), SupplierLookupQuery{Search: c.Query("search"), Limit: limit})
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "suppliers lookup fetched successfully", result)
}

func (h *Handler) CreateSupplier(c *gin.Context) {
	var req CreateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateSupplier(utils.MustAuthContext(c), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "supplier created successfully", result)
}

func (h *Handler) GetSupplier(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.GetSupplier(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier fetched successfully", result)
}

func (h *Handler) UpdateSupplier(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateSupplier(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier updated successfully", result)
}

func (h *Handler) UpdateSupplierStatus(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req UpdateSupplierStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateSupplierStatus(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier status updated successfully", result)
}

func (h *Handler) DeleteSupplier(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	if err := h.service.DeleteSupplier(utils.MustAuthContext(c), c.Param("id"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListContacts(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ListContacts(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier contacts fetched successfully", result)
}

func (h *Handler) CreateContact(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req CreateSupplierContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.CreateContact(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "supplier contact created successfully", result)
}

func (h *Handler) UpdateContact(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "contactId") {
		return
	}
	var req UpdateSupplierContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.UpdateContact(utils.MustAuthContext(c), c.Param("id"), c.Param("contactId"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier contact updated successfully", result)
}

func (h *Handler) DeleteContact(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "contactId") {
		return
	}
	if err := h.service.DeleteContact(utils.MustAuthContext(c), c.Param("id"), c.Param("contactId"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier contact deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) ListNotes(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.ListNotes(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier notes fetched successfully", result)
}

func (h *Handler) AddNote(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	var req CreateSupplierNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	result, err := h.service.AddNote(utils.MustAuthContext(c), c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "supplier note added successfully", result)
}

func (h *Handler) DeleteNote(c *gin.Context) {
	if !validUUIDParam(c, "id") || !validUUIDParam(c, "noteId") {
		return
	}
	if err := h.service.DeleteNote(utils.MustAuthContext(c), c.Param("id"), c.Param("noteId"), c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier note deleted successfully", gin.H{"deleted": true})
}

func (h *Handler) Stats(c *gin.Context) {
	if !validUUIDParam(c, "id") {
		return
	}
	result, err := h.service.Stats(utils.MustAuthContext(c), c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "supplier stats fetched successfully", result)
}

func parseSupplierListQuery(c *gin.Context) SupplierListQuery {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	return SupplierListQuery{
		Search:    c.Query("search"),
		Status:    c.Query("status"),
		City:      c.Query("city"),
		Country:   c.Query("country"),
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
