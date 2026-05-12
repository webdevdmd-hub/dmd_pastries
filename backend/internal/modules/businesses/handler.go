package businesses

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

func (h *Handler) GetBusiness(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	business, err := h.service.GetBusiness(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "business fetched successfully", business)
}

func (h *Handler) UpdateBusiness(c *gin.Context) {
	var req UpdateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	business, err := h.service.UpdateBusiness(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "business updated successfully", business)
}

func (h *Handler) GetOnboardingStatus(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	status, err := h.service.GetOnboardingStatus(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "onboarding status fetched successfully", status)
}

func (h *Handler) GetSettings(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	settings, err := h.service.GetSettings(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "settings fetched successfully", settings)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	var req UpdateBusinessSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	settings, err := h.service.UpdateSettings(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "settings updated successfully", settings)
}

func (h *Handler) SwitchBranch(c *gin.Context) {
	var req SwitchBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	result, err := h.service.SwitchBranch(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "branch switched successfully", result)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
