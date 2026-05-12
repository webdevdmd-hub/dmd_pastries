package audit

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

func (h *Handler) ListActivityLogs(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	resp, err := h.service.ListActivityLogs(
		currentUser,
		c.Query("entity_type"),
		c.Query("cursor"),
		c.Query("limit"),
	)
	if err != nil {
		handleError(c, err)
		return
	}

	response.Success(c, 200, "activity logs fetched successfully", resp)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
