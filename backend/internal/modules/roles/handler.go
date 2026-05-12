package roles

import (
	"github.com/gin-gonic/gin"

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

func (h *Handler) ListRoles(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	roles, err := h.service.ListRoles(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "roles fetched successfully", roles)
}

func (h *Handler) CreateRole(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	role, err := h.service.CreateRole(currentUser, req)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 201, "role created successfully", role)
}

func (h *Handler) UpdateRole(c *gin.Context) {
	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	role, err := h.service.UpdateRole(currentUser, c.Param("id"), req)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "role updated successfully", role)
}

func (h *Handler) DeleteRole(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	if err := h.service.DeleteRole(currentUser, c.Param("id")); err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "role deleted successfully", nil)
}

func (h *Handler) GetRolePermissions(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	rolePermissions, err := h.service.GetRolePermissions(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "role permissions fetched successfully", rolePermissions)
}

func (h *Handler) UpdateRolePermissions(c *gin.Context) {
	var req UpdateRolePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	rolePermissions, err := h.service.UpdateRolePermissions(currentUser, c.Param("id"), req)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "role permissions updated successfully", rolePermissions)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}

	response.Error(c, 500, "internal server error", err.Error())
}
