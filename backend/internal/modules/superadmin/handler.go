package superadmin

import (
	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/auth"
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

func (h *Handler) Me(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)

	response.Success(c, 200, "super admin profile fetched successfully", auth.PlatformAdminProfileResponse{
		AccountType:      "platform_admin",
		AppwriteUserID:   currentUser.AppwriteUserID,
		FullName:         currentUser.FullName,
		Email:            currentUser.Email,
		EmailVerified:    true,
		Permissions:      []string{"super_admin.access"},
		SuperAdminStatus: "active",
	})
}

func (h *Handler) ListBusinesses(c *gin.Context) {
	businesses, err := h.service.ListBusinesses(c.Query("search"), c.Query("status"))
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform businesses fetched successfully", businesses)
}

func (h *Handler) GetBusiness(c *gin.Context) {
	business, err := h.service.GetBusiness(c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform business fetched successfully", business)
}

func (h *Handler) UpdateBusinessAction(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	var req UpdateBusinessActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 400, "invalid business action payload", err.Error())
		return
	}

	business, err := h.service.UpdateBusinessAction(
		currentUser,
		c.Param("id"),
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform business action applied successfully", business)
}

func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.service.ListUsers(UserFilters{
		BusinessID: c.Query("business_id"),
		Search:     c.Query("search"),
		Status:     c.Query("status"),
	})
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform users fetched successfully", users)
}

func (h *Handler) GetUser(c *gin.Context) {
	user, err := h.service.GetUser(c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform user fetched successfully", user)
}

func (h *Handler) GetUserHardDeletePreview(c *gin.Context) {
	preview, err := h.service.GetUserHardDeletePreview(c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform user hard delete preview fetched successfully", preview)
}

func (h *Handler) UpdateUserAction(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	var req UpdateUserActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 400, "invalid user action payload", err.Error())
		return
	}

	user, err := h.service.UpdateUserAction(
		currentUser,
		c.Param("id"),
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform user action applied successfully", user)
}

func (h *Handler) ListTables(c *gin.Context) {
	response.Success(c, 200, "platform table allowlist fetched successfully", h.service.ListTables())
}

func (h *Handler) ListTableRows(c *gin.Context) {
	rows, err := h.service.ListTableRows(
		c.Param("table"),
		c.Query("business_id"),
		c.Query("search"),
		c.Query("page"),
		c.Query("limit"),
	)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform table rows fetched successfully", rows)
}

func (h *Handler) UpdateTableRow(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	var req UpdateTableRowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, 400, "invalid table row action payload", err.Error())
		return
	}

	row, err := h.service.UpdateTableRow(
		currentUser,
		c.Param("table"),
		c.Param("id"),
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform table row action applied successfully", row)
}

func (h *Handler) Diagnostics(c *gin.Context) {
	diagnostics, err := h.service.Diagnostics()
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "platform diagnostics fetched successfully", diagnostics)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
