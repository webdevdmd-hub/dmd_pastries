package permissions

import (
	"github.com/gin-gonic/gin"

	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListPermissions(c *gin.Context) {
	permissions, err := h.service.ListPermissions()
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "permissions fetched successfully", permissions)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}

	response.Error(c, 500, "internal server error", err.Error())
}
