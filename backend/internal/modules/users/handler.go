package users

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

func (h *Handler) ListUsers(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	users, err := h.service.ListUsers(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "users fetched successfully", users)
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	user, err := h.service.CreateUser(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "user created successfully", user)
}

func (h *Handler) InviteUser(c *gin.Context) {
	var req InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	user, err := h.service.InviteUser(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "user invited successfully", user)
}

func (h *Handler) CreateInvitation(c *gin.Context) {
	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	invite, err := h.service.CreateInvitation(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "Invitation sent.", invite)
}

func (h *Handler) ListInvitations(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	invites, err := h.service.ListInvitations(currentUser, c.Query("status"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "invitations fetched successfully", invites)
}

func (h *Handler) ResendInvitation(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	invite, err := h.service.ResendInvitation(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "invitation resent successfully", invite)
}

func (h *Handler) CancelInvitation(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	invite, err := h.service.CancelInvitation(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "invitation cancelled successfully", invite)
}

func (h *Handler) AcceptInvitation(c *gin.Context) {
	var req AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	user, err := h.service.AcceptInvitation(req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "invitation accepted successfully", user)
}

func (h *Handler) GetUser(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	user, err := h.service.GetUser(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user fetched successfully", user)
}

func (h *Handler) GetUserActivity(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	activity, err := h.service.GetUserActivity(currentUser, c.Param("id"), c.Query("cursor"), c.Query("limit"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user activity fetched successfully", activity)
}

func (h *Handler) AssignUserBranch(c *gin.Context) {
	var req AssignBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	user, err := h.service.AssignUserBranch(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user branch assigned successfully", user)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	user, err := h.service.UpdateUser(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user updated successfully", user)
}

func (h *Handler) UpdateUserStatus(c *gin.Context) {
	var req UpdateUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	user, err := h.service.UpdateUserStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user status updated successfully", user)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	deleted, err := h.service.DeleteUser(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user deleted successfully", deleted)
}

func (h *Handler) RestoreUser(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	user, err := h.service.RestoreUser(currentUser, c.Param("id"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "user restored successfully", user)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
