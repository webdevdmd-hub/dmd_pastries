package branches

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

func (h *Handler) ListBranches(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	branches, err := h.service.ListBranches(currentUser)
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "branches fetched successfully", branches)
}

func (h *Handler) CreateBranch(c *gin.Context) {
	var req CreateBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	branch, err := h.service.CreateBranch(currentUser, req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 201, "branch created successfully", branch)
}

func (h *Handler) GetBranch(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	branch, err := h.service.GetBranch(currentUser, c.Param("id"))
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "branch fetched successfully", branch)
}

func (h *Handler) UpdateBranch(c *gin.Context) {
	var req UpdateBranchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	branch, err := h.service.UpdateBranch(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "branch updated successfully", branch)
}

func (h *Handler) UpdateBranchStatus(c *gin.Context) {
	var req UpdateBranchStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}

	currentUser := utils.MustAuthContext(c)
	branch, err := h.service.UpdateBranchStatus(currentUser, c.Param("id"), req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, 200, "branch status updated successfully", branch)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, 500, "internal server error", err.Error())
}
