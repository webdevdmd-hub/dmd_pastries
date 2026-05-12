package dashboard

import (
	"net/http"

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

func (h *Handler) AdminDashboard(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.AdminDashboard(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.write(c, data, err)
}

func (h *Handler) CashierDashboard(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.CashierDashboard(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.write(c, data, err)
}

func (h *Handler) ProductionDashboard(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ProductionDashboard(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.write(c, data, err)
}

func (h *Handler) PurchasingDashboard(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.PurchasingDashboard(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.write(c, data, err)
}

func (h *Handler) RecentActivity(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.RecentActivity(currentUser, c.Request.URL.Query())
	h.write(c, data, err)
}

func (h *Handler) Alerts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.Alerts(currentUser, c.Request.URL.Query())
	h.write(c, data, err)
}

func (h *Handler) KPISummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.KPISummary(currentUser, c.Request.URL.Query())
	h.write(c, data, err)
}

func (h *Handler) write(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Dashboard loaded successfully", data)
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, http.StatusInternalServerError, "internal server error", err.Error())
}
