package auth

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

func (h *Handler) RegisterOwner(c *gin.Context) {
	var req RegisterOwnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	resp, err := h.service.RegisterOwner(req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 201, "owner registered successfully", resp)
}

func (h *Handler) LoginSync(c *gin.Context) {
	var req LoginSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	resp, err := h.service.LoginSync(req.JWT, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "login sync successful", resp)
}

func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var req PasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	if err := h.service.RequestPasswordReset(req); err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "password reset requested successfully", gin.H{
		"sent": true,
	})
}

func (h *Handler) CompletePasswordReset(c *gin.Context) {
	var req PasswordResetCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	if err := h.service.CompletePasswordReset(req); err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "password reset completed successfully", gin.H{
		"reset": true,
	})
}

func (h *Handler) Me(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	resp, err := h.service.Me(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "authenticated user fetched successfully", resp)
}

func (h *Handler) LogoutSync(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	if err := h.service.LogoutSync(currentUser, c.ClientIP(), c.Request.UserAgent()); err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "logout sync successful", gin.H{
		"logged_out": true,
	})
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
