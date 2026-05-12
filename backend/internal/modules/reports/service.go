package reports

import (
	"fmt"
	"net/url"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/audit"
	reportcache "pastries-pos/internal/modules/reports/cache"
	"pastries-pos/internal/modules/reports/shared"
	apperrors "pastries-pos/internal/shared/errors"
	"pastries-pos/internal/shared/utils"
)

type Service struct {
	db        *gorm.DB
	repo      *Repository
	auditRepo *audit.Repository
	cache     *reportcache.Service
}

func NewService(db *gorm.DB, repo *Repository, auditRepo *audit.Repository, cache *reportcache.Service) *Service {
	return &Service{db: db, repo: repo, auditRepo: auditRepo, cache: cache}
}

func (s *Service) DashboardSummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*DashboardSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	summary, err := s.repo.DashboardSummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate dashboard summary")
	}
	_ = s.writeAudit(currentUser, "report.dashboard_viewed", "reports", "dashboard_summary", "Dashboard report viewed.", filter, ipAddress, userAgent)
	return summary, nil
}

func (s *Service) SalesChart(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	return s.chart(currentUser, values, "Sales", s.repo.SalesChart, ipAddress, userAgent)
}

func (s *Service) PaymentsChart(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	return s.chart(currentUser, values, "Payments", s.repo.PaymentsChart, ipAddress, userAgent)
}

func (s *Service) OrdersChart(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	return s.chart(currentUser, values, "Orders", s.repo.OrdersChart, ipAddress, userAgent)
}

func (s *Service) SalesReportSummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*SalesReportSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.SalesReportSummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate sales summary report")
	}
	_ = s.writeAudit(currentUser, "report.sales_summary_viewed", "reports", "sales_summary", "Sales summary report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) DailySalesReport(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]DailySalesReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.DailySalesReport(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate daily sales report")
	}
	_ = s.writeAudit(currentUser, "report.summary_viewed", "reports", "sales_daily", "Daily sales report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) SalesByProduct(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[ProductSalesReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.SalesByProduct(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate product sales report")
	}
	return &PaginatedResponse[ProductSalesReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) SalesByCategory(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]CategorySalesReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.SalesByCategory(filter)
}

func (s *Service) SalesByCashier(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]CashierSalesReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.SalesByCashier(filter)
}

func (s *Service) SalesByBranch(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]BranchSalesReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.SalesByBranch(filter)
}

func (s *Service) DiscountReport(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*DiscountReportResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.DiscountReport(filter)
}

func (s *Service) TaxReport(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]TaxReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.TaxReport(filter)
}

func (s *Service) TopProducts(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]ProductSalesReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.TopProducts(filter)
}

func (s *Service) SlowMovingProducts(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]SlowMovingProductReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.SlowMovingProducts(filter)
}

func (s *Service) SalesTrend(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.SalesTrend(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate sales trend report")
	}
	labels := make([]string, 0, len(rows))
	netSales := make([]float64, 0, len(rows))
	salesCount := make([]float64, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Bucket.Format("2006-01-02"))
		netSales = append(netSales, row.NetSales)
		salesCount = append(salesCount, row.SalesCount)
	}
	return &shared.ChartResponse{Labels: labels, Datasets: []shared.ChartDataset{{Label: "Net Sales", Data: netSales}, {Label: "Sales Count", Data: salesCount}}}, nil
}

func (s *Service) InventorySummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*InventoryReportSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.InventorySummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate inventory summary report")
	}
	_ = s.writeAudit(currentUser, "report.inventory_summary_viewed", "reports", "inventory_summary", "Inventory summary report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) CurrentStock(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[CurrentStockReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.CurrentStock(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate current stock report")
	}
	return &PaginatedResponse[CurrentStockReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) StockValuation(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*StockValuationReportResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.StockValuation(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate stock valuation report")
	}
	return result, nil
}

func (s *Service) LowStock(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]LowStockReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.LowStock(filter)
}

func (s *Service) ExpiryReport(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]ExpiryReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.ExpiryReport(filter)
}

func (s *Service) InventoryMovements(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[InventoryMovementReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.InventoryMovements(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate inventory movement report")
	}
	return &PaginatedResponse[InventoryMovementReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) WastageReport(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*WastageReportResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.WastageReport(filter)
}

func (s *Service) PackagingStock(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]PackagingStockReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.PackagingStock(filter)
}

func (s *Service) InventoryAudit(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[InventoryAuditReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.InventoryAudit(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate inventory audit report")
	}
	_ = s.writeAudit(currentUser, "report.inventory_audit_viewed", "reports", "inventory_audit", "Inventory audit report viewed.", filter, ipAddress, userAgent)
	return &PaginatedResponse[InventoryAuditReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) InventoryTrend(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.InventoryTrend(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate inventory trend report")
	}
	labels := make([]string, 0, len(rows))
	stockIn := make([]float64, 0, len(rows))
	stockOut := make([]float64, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Bucket.Format("2006-01-02"))
		stockIn = append(stockIn, row.NetSales)
		stockOut = append(stockOut, row.SalesCount)
	}
	return &shared.ChartResponse{Labels: labels, Datasets: []shared.ChartDataset{{Label: "Stock In", Data: stockIn}, {Label: "Stock Out", Data: stockOut}}}, nil
}

func (s *Service) ManufacturingSummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*ManufacturingReportSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.ManufacturingReportSummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate manufacturing summary report")
	}
	_ = s.writeAudit(currentUser, "report.manufacturing_summary_viewed", "reports", "manufacturing_summary", "Manufacturing summary report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) ManufacturingBatches(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[ManufacturingBatchReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.ManufacturingBatches(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate manufacturing batch report")
	}
	return &PaginatedResponse[ManufacturingBatchReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) ManufacturingIngredientConsumption(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]IngredientConsumptionReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.ManufacturingIngredientConsumption(filter)
}

func (s *Service) ManufacturingYieldVariance(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]YieldVarianceReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.ManufacturingYieldVariance(filter)
}

func (s *Service) ManufacturingWastage(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*ManufacturingWastageReportResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.ManufacturingWastage(filter)
}

func (s *Service) ManufacturingRecipeCosts(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]RecipeCostReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.ManufacturingRecipeCosts(filter)
}

func (s *Service) ManufacturingTrend(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.ManufacturingTrend(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate manufacturing trend report")
	}
	labels := make([]string, 0, len(rows))
	produced := make([]float64, 0, len(rows))
	wastage := make([]float64, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Bucket.Format("2006-01-02"))
		produced = append(produced, row.NetSales)
		wastage = append(wastage, row.SalesCount)
	}
	return &shared.ChartResponse{Labels: labels, Datasets: []shared.ChartDataset{{Label: "Produced Quantity", Data: produced}, {Label: "Wastage Quantity", Data: wastage}}}, nil
}

func (s *Service) BakeryOrdersSummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*BakeryOrdersReportSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.BakeryOrdersSummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate bakery orders summary report")
	}
	_ = s.writeAudit(currentUser, "report.bakery_orders_summary_viewed", "reports", "bakery_orders_summary", "Bakery orders summary report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) BakeryOrdersUpcoming(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[UpcomingBakeryOrderReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.BakeryOrdersUpcoming(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate upcoming bakery orders report")
	}
	return &PaginatedResponse[UpcomingBakeryOrderReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) BakeryOrdersStatus(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]BakeryOrderStatusReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.BakeryOrdersStatus(filter)
}

func (s *Service) BakeryOrdersProductionSchedule(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]BakeryOrderProductionScheduleItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.BakeryOrdersProductionSchedule(filter)
}

func (s *Service) BakeryOrdersPendingPayments(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*BakeryOrderPendingPaymentsResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.BakeryOrdersPendingPayments(filter)
}

func (s *Service) BakeryOrdersDeliveryVsPickup(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*BakeryOrderDeliveryVsPickupResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.BakeryOrdersDeliveryVsPickup(filter)
}

func (s *Service) BakeryOrdersTrend(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.BakeryOrdersTrend(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate bakery orders trend report")
	}
	labels := make([]string, 0, len(rows))
	orders := make([]float64, 0, len(rows))
	revenue := make([]float64, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Bucket.Format("2006-01-02"))
		orders = append(orders, row.SalesCount)
		revenue = append(revenue, row.NetSales)
	}
	return &shared.ChartResponse{Labels: labels, Datasets: []shared.ChartDataset{{Label: "Orders", Data: orders}, {Label: "Revenue", Data: revenue}}}, nil
}

func (s *Service) FinancialSummary(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*FinancialSummaryResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	result, err := s.repo.FinancialSummary(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate financial summary report")
	}
	_ = s.writeAudit(currentUser, "report.financial_summary_viewed", "reports", "financial_summary", "Financial summary report viewed.", filter, ipAddress, userAgent)
	return result, nil
}

func (s *Service) FinancialPayments(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[FinancialPaymentReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.FinancialPayments(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate financial payments report")
	}
	_ = s.writeAudit(currentUser, "report.financial_payments_viewed", "reports", "financial_payments", "Financial payments report viewed.", filter, ipAddress, userAgent)
	return &PaginatedResponse[FinancialPaymentReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) FinancialByPaymentMethod(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) ([]FinancialPaymentMethodReportItem, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.FinancialByPaymentMethod(filter)
}

func (s *Service) FinancialRefunds(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[FinancialRefundReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.FinancialRefunds(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate financial refunds report")
	}
	return &PaginatedResponse[FinancialRefundReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) FinancialOutstandingBalances(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[OutstandingBalanceReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.FinancialOutstandingBalances(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate outstanding balances report")
	}
	return &PaginatedResponse[OutstandingBalanceReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) FinancialSupplierPayables(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[SupplierPayableReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.FinancialSupplierPayables(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate supplier payables report")
	}
	return &PaginatedResponse[SupplierPayableReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) FinancialPurchaseTotals(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PurchaseTotalsReportResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	return s.repo.FinancialPurchaseTotals(filter)
}

func (s *Service) FinancialReconciliation(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*PaginatedResponse[ReconciliationReportItem], error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	items, total, err := s.repo.FinancialReconciliation(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate reconciliation report")
	}
	return &PaginatedResponse[ReconciliationReportItem]{Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (s *Service) FinancialTrend(currentUser *utils.AuthContext, values url.Values, ipAddress, userAgent string) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.FinancialTrend(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate financial trend report")
	}
	labels := make([]string, 0, len(rows))
	collected := make([]float64, 0, len(rows))
	refunded := make([]float64, 0, len(rows))
	net := make([]float64, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Bucket.Format("2006-01-02"))
		collected = append(collected, row.NetSales)
		refunded = append(refunded, row.SalesCount)
		net = append(net, row.NetSales-row.SalesCount)
	}
	return &shared.ChartResponse{Labels: labels, Datasets: []shared.ChartDataset{{Label: "Collected", Data: collected}, {Label: "Refunded", Data: refunded}, {Label: "Net Collected", Data: net}}}, nil
}

func (s *Service) ExportCSV(currentUser *utils.AuthContext, reportType string, values url.Values, ipAddress, userAgent string) (*shared.CSVFile, error) {
	if reportType != "sales" && reportType != "payments" && reportType != "orders" {
		return nil, apperrors.BadRequest("invalid report_type", nil)
	}
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	headers, rows, err := s.repo.ExportRows(reportType, filter)
	if err != nil {
		return nil, apperrors.Internal("failed to export report")
	}
	filename := fmt.Sprintf("%s-report-%s.csv", reportType, time.Now().UTC().Format("20060102150405"))
	file, err := shared.BuildCSV(filename, headers, rows)
	if err != nil {
		return nil, apperrors.Internal("failed to build CSV")
	}
	_ = s.writeAudit(currentUser, "report.exported", "reports", reportType, "Report exported.", filter, ipAddress, userAgent)
	return file, nil
}

func (s *Service) chart(
	currentUser *utils.AuthContext,
	values url.Values,
	label string,
	load func(*shared.ResolvedFilter) ([]shared.ChartPoint, error),
	ipAddress, userAgent string,
) (*shared.ChartResponse, error) {
	filter, err := shared.Resolve(currentUser, shared.ParseQuery(values))
	if err != nil {
		return nil, err
	}
	points, err := load(filter)
	if err != nil {
		return nil, apperrors.Internal("failed to generate chart report")
	}
	_ = s.writeAudit(currentUser, "report.summary_viewed", "reports", label, "Chart report viewed.", filter, ipAddress, userAgent)
	chart := shared.SingleDatasetChart(label, points)
	return &chart, nil
}

func (s *Service) writeAudit(currentUser *utils.AuthContext, eventType, entityType, entityID, summary string, filter *shared.ResolvedFilter, ipAddress, userAgent string) error {
	metadata := map[string]interface{}{}
	if filter != nil {
		metadata = map[string]interface{}{
			"branch_id":     filter.BranchID,
			"all_branches":  filter.AllBranches,
			"date_from":     filter.DateFrom.Format("2006-01-02"),
			"date_to":       filter.DateTo.Format("2006-01-02"),
			"timezone":      filter.Timezone,
			"group_by":      filter.GroupBy,
			"generated_at":  time.Now().UTC().Format(time.RFC3339),
			"cache_enabled": s.cache != nil,
		}
	}
	return s.auditRepo.CreateActivity(s.db, audit.ActivityInput{
		BusinessID:  currentUser.BusinessID,
		ActorUserID: currentUser.UserID,
		EventType:   eventType,
		EntityType:  entityType,
		EntityID:    entityID,
		Summary:     summary,
		Metadata:    metadata,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	})
}
