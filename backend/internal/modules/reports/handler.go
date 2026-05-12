package reports

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"

	"pastries-pos/internal/modules/reports/shared"
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

func (h *Handler) DashboardSummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	summary, err := h.service.DashboardSummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "dashboard summary fetched successfully", summary)
}

func (h *Handler) SalesChart(c *gin.Context) {
	h.chart(c, h.service.SalesChart, "sales chart fetched successfully")
}

func (h *Handler) PaymentsChart(c *gin.Context) {
	h.chart(c, h.service.PaymentsChart, "payments chart fetched successfully")
}

func (h *Handler) OrdersChart(c *gin.Context) {
	h.chart(c, h.service.OrdersChart, "orders chart fetched successfully")
}

func (h *Handler) SalesSummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesReportSummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) DailySales(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.DailySalesReport(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesByProduct(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesByProduct(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesByCategory(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesByCategory(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesByCashier(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesByCashier(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesByBranch(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesByBranch(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesDiscounts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.DiscountReport(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesTaxes(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.TaxReport(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) TopProducts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.TopProducts(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SlowMovingProducts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SlowMovingProducts(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) SalesTrend(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.SalesTrend(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeReport(c, data, err)
}

func (h *Handler) InventorySummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.InventorySummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) CurrentStock(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.CurrentStock(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) StockValuation(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.StockValuation(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) LowStock(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.LowStock(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) ExpiryReport(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ExpiryReport(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) InventoryMovements(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.InventoryMovements(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) WastageReport(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.WastageReport(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) PackagingStock(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.PackagingStock(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) InventoryAudit(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.InventoryAudit(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) InventoryTrend(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.InventoryTrend(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeInventoryReport(c, data, err)
}

func (h *Handler) ManufacturingSummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingSummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingBatches(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingBatches(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingIngredientConsumption(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingIngredientConsumption(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingYieldVariance(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingYieldVariance(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingWastage(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingWastage(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingRecipeCosts(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingRecipeCosts(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) ManufacturingTrend(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.ManufacturingTrend(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeManufacturingReport(c, data, err)
}

func (h *Handler) BakeryOrdersSummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersSummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersUpcoming(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersUpcoming(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersStatus(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersStatus(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersProductionSchedule(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersProductionSchedule(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersPendingPayments(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersPendingPayments(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersDeliveryVsPickup(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersDeliveryVsPickup(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) BakeryOrdersTrend(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.BakeryOrdersTrend(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeBakeryOrdersReport(c, data, err)
}

func (h *Handler) FinancialSummary(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialSummary(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialPayments(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialPayments(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialByPaymentMethod(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialByPaymentMethod(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialRefunds(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialRefunds(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialOutstandingBalances(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialOutstandingBalances(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialSupplierPayables(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialSupplierPayables(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialPurchaseTotals(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialPurchaseTotals(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialReconciliation(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialReconciliation(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) FinancialTrend(c *gin.Context) {
	currentUser := utils.MustAuthContext(c)
	data, err := h.service.FinancialTrend(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	h.writeFinancialReport(c, data, err)
}

func (h *Handler) ExportCSVGet(c *gin.Context) {
	reportType := c.DefaultQuery("report_type", "sales")
	h.exportCSV(c, reportType, c.Request.URL.Query())
}

func (h *Handler) ExportCSVPost(c *gin.Context) {
	var req CSVExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		handleError(c, apperrors.BadRequest("invalid request payload", err.Error()))
		return
	}
	values := valuesFromMap(req.Filters)
	h.exportCSV(c, req.ReportType, values)
}

func (h *Handler) chart(c *gin.Context, load func(*utils.AuthContext, url.Values, string, string) (*shared.ChartResponse, error), message string) {
	currentUser := utils.MustAuthContext(c)
	data, err := load(currentUser, c.Request.URL.Query(), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, message, data)
}

func (h *Handler) writeReport(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Sales report generated successfully", data)
}

func (h *Handler) writeInventoryReport(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Inventory report generated successfully", data)
}

func (h *Handler) writeManufacturingReport(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Manufacturing report generated successfully", data)
}

func (h *Handler) writeBakeryOrdersReport(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Bakery orders report generated successfully", data)
}

func (h *Handler) writeFinancialReport(c *gin.Context, data interface{}, err error) {
	if err != nil {
		handleError(c, err)
		return
	}
	response.Success(c, http.StatusOK, "Financial report generated successfully", data)
}

func (h *Handler) exportCSV(c *gin.Context, reportType string, values url.Values) {
	currentUser := utils.MustAuthContext(c)
	file, err := h.service.ExportCSV(currentUser, reportType, values, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		handleError(c, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", file.Filename))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", file.Content)
}

func valuesFromMap(input map[string]interface{}) url.Values {
	values := url.Values{}
	for key, value := range input {
		if value == nil {
			continue
		}
		values.Set(key, fmt.Sprint(value))
	}
	return values
}

func handleError(c *gin.Context, err error) {
	if appErr, ok := err.(*apperrors.AppError); ok {
		response.Error(c, appErr.StatusCode, appErr.Message, appErr.Details)
		return
	}
	response.Error(c, http.StatusInternalServerError, "internal server error", err.Error())
}
