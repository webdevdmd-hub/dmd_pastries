package reports

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"pastries-pos/internal/modules/reports/shared"
)

type Repository struct {
	db *gorm.DB
}

type timeSeriesRow struct {
	Bucket time.Time
	Value  float64
}

type trendSeriesRow struct {
	Bucket     time.Time
	NetSales   float64
	SalesCount float64
}

type salesSummarySQLRow struct {
	GrossSales    float64
	NetSales      float64
	SalesCount    int64
	ItemsSold     float64
	DiscountTotal float64
	TaxTotal      float64
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) DashboardSummary(filter *shared.ResolvedFilter) (*DashboardSummaryResponse, error) {
	sales, err := r.salesSummary(filter)
	if err != nil {
		return nil, err
	}
	inventory, err := r.inventorySummary(filter)
	if err != nil {
		return nil, err
	}
	manufacturing, err := r.manufacturingSummary(filter)
	if err != nil {
		return nil, err
	}
	orders, err := r.ordersSummary(filter)
	if err != nil {
		return nil, err
	}
	payments, err := r.paymentsSummary(filter)
	if err != nil {
		return nil, err
	}
	return &DashboardSummaryResponse{
		Sales:         *sales,
		Inventory:     *inventory,
		Manufacturing: *manufacturing,
		Orders:        *orders,
		Payments:      *payments,
	}, nil
}

func (r *Repository) SalesChart(filter *shared.ResolvedFilter) ([]shared.ChartPoint, error) {
	rows := []timeSeriesRow{}
	query, args := baseTimeSeriesQuery(
		"sold_at",
		"SUM(total_amount)",
		"sales",
		"sale_status <> 'voided' AND deleted_at IS NULL",
		filter,
	)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return toChartPoints(rows, filter.GroupBy), nil
}

func (r *Repository) PaymentsChart(filter *shared.ResolvedFilter) ([]shared.ChartPoint, error) {
	rows := []struct {
		Label string
		Value float64
	}{}
	query := "SELECT payment_method_name_snapshot AS label, COALESCE(SUM(amount),0) AS value FROM sale_payments WHERE business_id = ? AND paid_at >= ? AND paid_at < ? AND payment_status IN ('completed','partially_refunded','refunded') AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		query += " AND branch_id = ?"
		args = append(args, filter.BranchID)
	}
	query += " GROUP BY payment_method_name_snapshot ORDER BY payment_method_name_snapshot ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	points := make([]shared.ChartPoint, 0, len(rows))
	for _, row := range rows {
		points = append(points, shared.ChartPoint{Label: row.Label, Value: row.Value})
	}
	return points, nil
}

func (r *Repository) OrdersChart(filter *shared.ResolvedFilter) ([]shared.ChartPoint, error) {
	rows := []timeSeriesRow{}
	query, args := baseDateSeriesQuery(
		"event_date",
		"COUNT(*)",
		"bakery_orders",
		"deleted_at IS NULL",
		filter,
	)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return toChartPoints(rows, filter.GroupBy), nil
}

func (r *Repository) ExportRows(reportType string, filter *shared.ResolvedFilter) ([]string, [][]string, error) {
	switch reportType {
	case "sales":
		return r.salesExportRows(filter)
	case "payments":
		return r.paymentsExportRows(filter)
	case "orders":
		return r.ordersExportRows(filter)
	default:
		return nil, nil, fmt.Errorf("unsupported report type")
	}
}

func (r *Repository) SalesReportSummary(filter *shared.ResolvedFilter) (*SalesReportSummaryResponse, error) {
	current, err := r.salesReportSummaryForRange(filter, filter.StartUTC, filter.EndUTC)
	if err != nil {
		return nil, err
	}
	period := filter.EndUTC.Sub(filter.StartUTC)
	previousStart := filter.StartUTC.Add(-period)
	previous, err := r.salesReportSummaryForRange(filter, previousStart, filter.StartUTC)
	if err != nil {
		return nil, err
	}
	current.PreviousPeriod = SalesPreviousPeriodComparison{
		GrossSalesChangePercentage: percentageChange(current.GrossSales, previous.GrossSales),
		NetSalesChangePercentage:   percentageChange(current.NetSales, previous.NetSales),
		SalesCountChangePercentage: percentageChange(float64(current.SalesCount), float64(previous.SalesCount)),
	}
	return current, nil
}

func (r *Repository) DailySalesReport(filter *shared.ResolvedFilter) ([]DailySalesReportItem, error) {
	rows := []struct {
		Bucket        time.Time
		GrossSales    float64
		NetSales      float64
		SalesCount    int64
		ItemsSold     float64
		DiscountTotal float64
		TaxTotal      float64
	}{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(s.subtotal_amount),0) AS gross_sales,
			COALESCE(SUM(s.total_amount),0) AS net_sales,
			COUNT(DISTINCT s.id) AS sales_count,
			COALESCE(SUM(si.quantity),0) AS items_sold,
			COALESCE(SUM(s.discount_amount),0) + COALESCE(SUM(si.discount_amount),0) AS discount_total,
			COALESCE(SUM(s.tax_amount),0) AS tax_total
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "s.sold_at"))
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	returnTotals, err := r.salesReturnTotalsByBucket(filter)
	if err != nil {
		return nil, err
	}
	returnByBucket := make(map[string]float64, len(returnTotals))
	for _, row := range returnTotals {
		returnByBucket[formatBucket(row.Bucket, filter.GroupBy)] = row.Value
	}
	items := make([]DailySalesReportItem, 0, len(rows))
	for _, row := range rows {
		bucket := formatBucket(row.Bucket, filter.GroupBy)
		items = append(items, DailySalesReportItem{Date: bucket, GrossSales: row.GrossSales, NetSales: row.NetSales - returnByBucket[bucket], SalesCount: row.SalesCount, ItemsSold: row.ItemsSold, DiscountTotal: row.DiscountTotal, TaxTotal: row.TaxTotal})
	}
	return items, nil
}

func (r *Repository) SalesByProduct(filter *shared.ResolvedFilter) ([]ProductSalesReportItem, int64, error) {
	sortBy := safeSort(filter.SortBy, map[string]string{"quantity_sold": "quantity_sold", "net_sales": "net_sales", "product_name": "product_name"}, "net_sales")
	items := []ProductSalesReportItem{}
	query := `
		SELECT si.product_id, si.product_name_snapshot AS product_name, COALESCE(NULLIF(si.sku_snapshot,''), p.sku, '') AS sku,
			COALESCE(SUM(si.quantity),0) AS quantity_sold,
			COALESCE(SUM(si.line_subtotal),0) AS gross_sales,
			COALESCE(SUM(si.discount_amount),0) AS discount_total,
			COALESCE(SUM(si.tax_amount),0) AS tax_total,
			COALESCE(SUM(si.line_total),0) AS net_sales
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY si.product_id, si.product_name_snapshot, si.sku_snapshot, p.sku ORDER BY " + sortBy + " " + filter.SortOrder + " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countGroupedSales(filter, "si.product_id")
	return items, total, err
}

func (r *Repository) SalesByCategory(filter *shared.ResolvedFilter) ([]CategorySalesReportItem, error) {
	items := []CategorySalesReportItem{}
	query := `
		SELECT pc.id AS category_id, pc.category_name,
			COALESCE(SUM(si.quantity),0) AS quantity_sold,
			COUNT(DISTINCT s.id) AS sales_count,
			COALESCE(SUM(si.line_subtotal),0) AS gross_sales,
			COALESCE(SUM(si.line_total),0) AS net_sales
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		JOIN products p ON p.id = si.product_id
		JOIN product_categories pc ON pc.id = p.category_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY pc.id, pc.category_name ORDER BY net_sales DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) SalesByCashier(filter *shared.ResolvedFilter) ([]CashierSalesReportItem, error) {
	items := []CashierSalesReportItem{}
	query := `
		SELECT s.cashier_user_id, u.full_name AS cashier_name,
			COUNT(DISTINCT s.id) FILTER (WHERE s.sale_status <> 'voided') AS sales_count,
			COALESCE(SUM(si.quantity) FILTER (WHERE s.sale_status <> 'voided'),0) AS items_sold,
			COALESCE(SUM(s.subtotal_amount) FILTER (WHERE s.sale_status <> 'voided'),0) AS gross_sales,
			COALESCE(SUM(s.total_amount) FILTER (WHERE s.sale_status <> 'voided'),0) AS net_sales,
			COUNT(DISTINCT pr.id) AS refund_count,
			COUNT(DISTINCT s.id) FILTER (WHERE s.sale_status = 'voided') AS void_count
		FROM sales s
		JOIN users u ON u.id = s.cashier_user_id
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		LEFT JOIN payment_refunds pr ON pr.sale_id = s.id AND pr.refund_status = 'completed' AND pr.deleted_at IS NULL
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY s.cashier_user_id, u.full_name ORDER BY net_sales DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) SalesByBranch(filter *shared.ResolvedFilter) ([]BranchSalesReportItem, error) {
	items := []BranchSalesReportItem{}
	query := `
		SELECT s.branch_id, b.branch_name,
			COUNT(DISTINCT s.id) AS sales_count,
			COALESCE(SUM(si.quantity),0) AS items_sold,
			COALESCE(SUM(s.subtotal_amount),0) AS gross_sales,
			COALESCE(SUM(s.total_amount),0) AS net_sales,
			COALESCE(SUM(s.tax_amount),0) AS tax_total
		FROM sales s
		JOIN branches b ON b.id = s.branch_id
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY s.branch_id, b.branch_name ORDER BY net_sales DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) DiscountReport(filter *shared.ResolvedFilter) (*DiscountReportResponse, error) {
	var summary struct {
		SaleLevelDiscount    float64
		LineLevelDiscount    float64
		DiscountedSalesCount int64
		GrossSales           float64
	}
	query := `
		SELECT COALESCE(SUM(s.discount_amount),0) AS sale_level_discount,
			COALESCE(SUM(si.discount_amount),0) AS line_level_discount,
			COUNT(DISTINCT s.id) FILTER (WHERE s.discount_amount > 0 OR si.discount_amount > 0) AS discounted_sales_count,
			COALESCE(SUM(s.subtotal_amount),0) AS gross_sales
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&summary).Error; err != nil {
		return nil, err
	}
	rows := []struct {
		SaleNumber     string
		Cashier        string
		DiscountType   string
		DiscountAmount float64
		SaleTotal      float64
		SoldAt         time.Time
	}{}
	itemQuery := `
		SELECT s.sale_number, u.full_name AS cashier, COALESCE(s.discount_type,'') AS discount_type,
			(s.discount_amount + COALESCE(SUM(si.discount_amount),0)) AS discount_amount,
			s.total_amount AS sale_total, s.sold_at
		FROM sales s
		JOIN users u ON u.id = s.cashier_user_id
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	itemArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	itemQuery, itemArgs = addSalesFilters(itemQuery, itemArgs, filter)
	itemQuery += " GROUP BY s.id, s.sale_number, u.full_name, s.discount_type, s.discount_amount, s.total_amount, s.sold_at HAVING (s.discount_amount + COALESCE(SUM(si.discount_amount),0)) > 0 ORDER BY s.sold_at DESC LIMIT ? OFFSET ?"
	itemArgs = append(itemArgs, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(itemQuery, itemArgs...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]DiscountReportItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, DiscountReportItem{SaleNumber: row.SaleNumber, Cashier: row.Cashier, DiscountType: row.DiscountType, DiscountAmount: row.DiscountAmount, SaleTotal: row.SaleTotal, SoldAt: row.SoldAt.Format(time.RFC3339)})
	}
	totalDiscount := summary.SaleLevelDiscount + summary.LineLevelDiscount
	percentage := 0.0
	if summary.GrossSales > 0 {
		percentage = (totalDiscount / summary.GrossSales) * 100
	}
	return &DiscountReportResponse{TotalDiscount: totalDiscount, SaleLevelDiscount: summary.SaleLevelDiscount, LineLevelDiscount: summary.LineLevelDiscount, DiscountedSalesCount: summary.DiscountedSalesCount, DiscountPercentageOfGrossSales: percentage, Items: items}, nil
}

func (r *Repository) TaxReport(filter *shared.ResolvedFilter) ([]TaxReportItem, error) {
	items := []TaxReportItem{}
	query := `
		SELECT si.tax_rate_id, COALESCE(si.tax_rate_name_snapshot,'No Tax') AS tax_name,
			COALESCE(si.tax_rate_percentage_snapshot,0) AS tax_percentage,
			COALESCE(SUM(si.line_subtotal - si.discount_amount),0) AS taxable_amount,
			COALESCE(SUM(si.tax_amount),0) AS tax_collected,
			COUNT(DISTINCT s.id) AS sales_count
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY si.tax_rate_id, si.tax_rate_name_snapshot, si.tax_rate_percentage_snapshot ORDER BY tax_collected DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) TopProducts(filter *shared.ResolvedFilter) ([]ProductSalesReportItem, error) {
	sortBy := safeSort(filter.SortBy, map[string]string{"quantity_sold": "quantity_sold", "net_sales": "net_sales"}, "quantity_sold")
	rows := []ProductSalesReportItem{}
	query := `
		SELECT si.product_id, si.product_name_snapshot AS product_name, COALESCE(NULLIF(si.sku_snapshot,''), p.sku, '') AS sku,
			COALESCE(SUM(si.quantity),0) AS quantity_sold,
			COALESCE(SUM(si.line_subtotal),0) AS gross_sales,
			COALESCE(SUM(si.discount_amount),0) AS discount_total,
			COALESCE(SUM(si.tax_amount),0) AS tax_total,
			COALESCE(SUM(si.line_total),0) AS net_sales
		FROM sale_items si
		JOIN sales s ON s.id = si.sale_id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY si.product_id, si.product_name_snapshot, si.sku_snapshot, p.sku ORDER BY " + sortBy + " DESC LIMIT ?"
	args = append(args, filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) SlowMovingProducts(filter *shared.ResolvedFilter) ([]SlowMovingProductReportItem, error) {
	rows := []struct {
		ProductID    string
		ProductName  string
		QuantitySold float64
		NetSales     float64
		LastSoldAt   *time.Time
	}{}
	query := `
		SELECT p.id AS product_id, p.product_name,
			COALESCE(SUM(si.quantity),0) AS quantity_sold,
			COALESCE(SUM(si.line_total),0) AS net_sales,
			MAX(s.sold_at) AS last_sold_at
		FROM products p
		LEFT JOIN sale_items si ON si.product_id = p.id
		LEFT JOIN sales s ON s.id = si.sale_id AND s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL
		WHERE p.business_id = ? AND p.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC, filter.BusinessID}
	if !filter.AllBranches {
		query += " AND p.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	query += " GROUP BY p.id, p.product_name ORDER BY quantity_sold ASC, net_sales ASC LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]SlowMovingProductReportItem, 0, len(rows))
	for _, row := range rows {
		var lastSold *string
		if row.LastSoldAt != nil {
			value := row.LastSoldAt.Format(time.RFC3339)
			lastSold = &value
		}
		items = append(items, SlowMovingProductReportItem{ProductID: row.ProductID, ProductName: row.ProductName, QuantitySold: row.QuantitySold, NetSales: row.NetSales, LastSoldAt: lastSold})
	}
	return items, nil
}

func (r *Repository) SalesTrend(filter *shared.ResolvedFilter) ([]trendSeriesRow, error) {
	rows := []trendSeriesRow{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(s.total_amount),0) AS net_sales,
			COUNT(DISTINCT s.id)::numeric AS sales_count
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "s.sold_at"))
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	returnTotals, err := r.salesReturnTotalsByBucket(filter)
	if err != nil {
		return nil, err
	}
	returnByBucket := make(map[string]float64, len(returnTotals))
	for _, row := range returnTotals {
		returnByBucket[formatBucket(row.Bucket, filter.GroupBy)] = row.Value
	}
	for i := range rows {
		bucket := formatBucket(rows[i].Bucket, filter.GroupBy)
		rows[i].NetSales -= returnByBucket[bucket]
	}
	return rows, nil
}

func (r *Repository) ReceiptRecords(filter *shared.ResolvedFilter) ([]ReceiptRecordReportItem, int64, error) {
	sortBy := safeSort(filter.SortBy, map[string]string{
		"sale_number":    "s.sale_number",
		"sold_at":        "s.sold_at",
		"total_amount":   "s.total_amount",
		"payment_status": "s.payment_status",
		"sale_status":    "s.sale_status",
		"view_count":     "COALESCE(rv.view_count,0)",
	}, "sold_at")

	rows := []struct {
		SaleID        string
		SaleNumber    string
		BranchName    string
		CustomerName  string
		CashierName   string
		TotalAmount   float64
		PaidAmount    float64
		PaymentStatus string
		SaleStatus    string
		SoldAt        time.Time
		ViewCount     int64
		LastViewedAt  *time.Time
	}{}

	query := `
		SELECT s.id AS sale_id,
			s.sale_number,
			b.branch_name,
			COALESCE(c.full_name, 'Walk-in Customer') AS customer_name,
			COALESCE(u.full_name, '') AS cashier_name,
			s.total_amount,
			s.paid_amount,
			s.payment_status,
			s.sale_status,
			s.sold_at,
			COALESCE(rv.view_count, 0) AS view_count,
			rv.last_viewed_at
		FROM sales s
		JOIN branches b ON b.id = s.branch_id
		LEFT JOIN customers c ON c.id = s.customer_id
		LEFT JOIN users u ON u.id = s.cashier_user_id
		LEFT JOIN (
			SELECT entity_id, COUNT(*) AS view_count, MAX(created_at) AS last_viewed_at
			FROM audit_logs
			WHERE business_id = ? AND event_type = 'sale.receipt_viewed' AND entity_type = 'sale'
			GROUP BY entity_id
		) rv ON rv.entity_id = s.id::text
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addReceiptRecordFilters(query, args, filter)
	query += " ORDER BY " + sortBy + " " + filter.SortOrder + " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	items := make([]ReceiptRecordReportItem, 0, len(rows))
	for _, row := range rows {
		var lastViewedAt *string
		if row.LastViewedAt != nil {
			value := row.LastViewedAt.Format(time.RFC3339)
			lastViewedAt = &value
		}
		receiptStatus := "not_viewed"
		if row.ViewCount > 0 {
			receiptStatus = "viewed"
		}
		items = append(items, ReceiptRecordReportItem{
			SaleID:        row.SaleID,
			SaleNumber:    row.SaleNumber,
			BranchName:    row.BranchName,
			CustomerName:  row.CustomerName,
			CashierName:   row.CashierName,
			TotalAmount:   row.TotalAmount,
			PaidAmount:    row.PaidAmount,
			PaymentStatus: row.PaymentStatus,
			SaleStatus:    row.SaleStatus,
			SoldAt:        row.SoldAt.Format(time.RFC3339),
			ViewCount:     row.ViewCount,
			LastViewedAt:  lastViewedAt,
			ReceiptStatus: receiptStatus,
		})
	}

	total, err := r.countReceiptRecords(filter)
	return items, total, err
}

func (r *Repository) InventorySummary(filter *shared.ResolvedFilter) (*InventoryReportSummaryResponse, error) {
	var row InventoryReportSummaryResponse
	query := `
		SELECT COUNT(*) AS total_inventory_items,
			COUNT(*) FILTER (WHERE ii.status = 'active') AS active_inventory_items,
			COUNT(*) FILTER (WHERE ii.available_quantity <= ii.reorder_level) AS low_stock_count,
			COUNT(*) FILTER (WHERE ii.available_quantity <= 0) AS out_of_stock_count,
			COUNT(*) FILTER (WHERE ii.is_expiry_tracked) AS expiry_tracked_count,
			COALESCE(SUM(ii.current_quantity * COALESCE(pv.cost_price, p.cost_price, ing.cost_per_unit, pi.cost_per_unit, 0)),0) AS total_stock_value
		FROM inventory_items ii
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&row).Error; err != nil {
		return nil, err
	}
	days := filter.Days
	if days == 0 {
		days = 30
	}
	var expiring int64
	expiryQuery := "SELECT COUNT(*) FROM expiry_batches eb WHERE eb.business_id = ? AND eb.deleted_at IS NULL AND eb.status = 'active' AND eb.expiry_date <= CURRENT_DATE + (? * INTERVAL '1 day')"
	expiryArgs := []interface{}{filter.BusinessID, days}
	if !filter.AllBranches {
		expiryQuery += " AND eb.branch_id = ?"
		expiryArgs = append(expiryArgs, filter.BranchID)
	}
	if err := r.db.Raw(expiryQuery, expiryArgs...).Scan(&expiring).Error; err != nil {
		return nil, err
	}
	row.ExpiringSoonCount = expiring
	return &row, nil
}

func (r *Repository) CurrentStock(filter *shared.ResolvedFilter) ([]CurrentStockReportItem, int64, error) {
	sortBy := safeSort(filter.SortBy, map[string]string{"item_name": "item_name", "current_quantity": "ii.current_quantity", "available_quantity": "ii.available_quantity", "reorder_level": "ii.reorder_level", "updated_at": "ii.updated_at"}, "item_name")
	items := []CurrentStockReportItem{}
	query := inventoryItemSelect() + " WHERE ii.business_id = ? AND ii.deleted_at IS NULL"
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	query += " ORDER BY " + sortBy + " " + filter.SortOrder + " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countInventoryItems(filter)
	return items, total, err
}

func (r *Repository) StockValuation(filter *shared.ResolvedFilter) (*StockValuationReportResponse, error) {
	items := []StockValuationReportItem{}
	query := `
		SELECT ii.id AS inventory_item_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			ii.item_type, b.branch_name, ii.current_quantity, u.symbol AS unit_symbol,
			COALESCE(pv.cost_price, p.cost_price, ing.cost_per_unit, pi.cost_per_unit, 0) AS unit_cost,
			(ii.current_quantity * COALESCE(pv.cost_price, p.cost_price, ing.cost_per_unit, pi.cost_per_unit, 0)) AS stock_value
		FROM inventory_items ii
		JOIN branches b ON b.id = ii.branch_id
		JOIN units u ON u.id = ii.unit_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	query += " ORDER BY stock_value " + filter.SortOrder + " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	total, err := r.countInventoryItems(filter)
	if err != nil {
		return nil, err
	}
	byType := []StockValueByItemType{}
	summaryQuery := `
		SELECT ii.item_type, COALESCE(SUM(ii.current_quantity * COALESCE(pv.cost_price, p.cost_price, ing.cost_per_unit, pi.cost_per_unit, 0)),0) AS stock_value
		FROM inventory_items ii
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.deleted_at IS NULL`
	summaryArgs := []interface{}{filter.BusinessID}
	summaryQuery, summaryArgs = addInventoryItemFilters(summaryQuery, summaryArgs, filter)
	summaryQuery += " GROUP BY ii.item_type ORDER BY ii.item_type"
	if err := r.db.Raw(summaryQuery, summaryArgs...).Scan(&byType).Error; err != nil {
		return nil, err
	}
	totalValue := 0.0
	for _, item := range byType {
		totalValue += item.StockValue
	}
	return &StockValuationReportResponse{TotalStockValue: totalValue, ByItemType: byType, Items: items, Pagination: shared.NewPagination(filter.Page, filter.Limit, total)}, nil
}

func (r *Repository) LowStock(filter *shared.ResolvedFilter) ([]LowStockReportItem, error) {
	items := []LowStockReportItem{}
	query := `
		SELECT ii.id AS inventory_item_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			b.branch_name, ii.available_quantity, ii.reorder_level,
			GREATEST(ii.reorder_level - ii.available_quantity, 0) AS shortage_quantity,
			u.symbol AS unit_symbol
		FROM inventory_items ii
		JOIN branches b ON b.id = ii.branch_id
		JOIN units u ON u.id = ii.unit_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.deleted_at IS NULL AND ii.available_quantity <= ii.reorder_level`
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	query += " ORDER BY shortage_quantity DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ExpiryReport(filter *shared.ResolvedFilter) ([]ExpiryReportItem, error) {
	days := filter.Days
	if days == 0 {
		days = 30
	}
	items := []ExpiryReportItem{}
	query := `
		SELECT eb.id AS batch_id, eb.inventory_item_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			b.branch_name, COALESCE(eb.batch_number,'') AS batch_number,
			eb.quantity, u.symbol AS unit_symbol,
			eb.received_date::text AS received_date, eb.expiry_date::text AS expiry_date,
			(eb.expiry_date - CURRENT_DATE)::int AS days_remaining,
			eb.status
		FROM expiry_batches eb
		JOIN inventory_items ii ON ii.id = eb.inventory_item_id
		JOIN branches b ON b.id = eb.branch_id
		JOIN units u ON u.id = ii.unit_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE eb.business_id = ? AND eb.deleted_at IS NULL AND eb.expiry_date <= CURRENT_DATE + (? * INTERVAL '1 day')`
	args := []interface{}{filter.BusinessID, days}
	if !filter.AllBranches {
		query += " AND eb.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.ItemType != "" {
		query += " AND ii.item_type = ?"
		args = append(args, filter.ItemType)
	}
	if filter.Status != "" {
		query += " AND eb.status = ?"
		args = append(args, filter.Status)
	}
	query += " ORDER BY eb.expiry_date ASC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) InventoryMovements(filter *shared.ResolvedFilter) ([]InventoryMovementReportItem, int64, error) {
	items := []InventoryMovementReportItem{}
	query := `
		SELECT sm.id AS movement_id, sm.created_at::text AS date, b.branch_name,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			sm.item_type, sm.movement_type, sm.movement_direction, sm.quantity,
			sm.before_quantity, sm.after_quantity, u.symbol AS unit_symbol,
			COALESCE(sm.reference_number,'') AS reference_number,
			COALESCE(us.full_name,'') AS created_by
		FROM stock_movements sm
		JOIN inventory_items ii ON ii.id = sm.inventory_item_id
		JOIN branches b ON b.id = sm.branch_id
		JOIN units u ON u.id = sm.unit_id
		LEFT JOIN users us ON us.id = sm.created_by_user_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at < ?`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addMovementFilters(query, args, filter)
	query += " ORDER BY sm.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countMovements(filter)
	return items, total, err
}

func (r *Repository) WastageReport(filter *shared.ResolvedFilter) (*WastageReportResponse, error) {
	items := []WastageReportItem{}
	query := `
		SELECT CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			sm.item_type, b.branch_name, sm.quantity, u.symbol AS unit_symbol,
			COALESCE(sm.reason,'') AS reason, sm.created_at::text AS created_at
		FROM stock_movements sm
		JOIN inventory_items ii ON ii.id = sm.inventory_item_id
		JOIN branches b ON b.id = sm.branch_id
		JOIN units u ON u.id = sm.unit_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at < ? AND sm.movement_type = 'wastage'`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addMovementFilters(query, args, filter)
	query += " ORDER BY sm.created_at DESC LIMIT ?"
	args = append(args, filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	var summary struct {
		TotalWastageQuantity float64
		WastageValue         float64
	}
	summaryQuery := `
		SELECT COALESCE(SUM(sm.quantity),0) AS total_wastage_quantity,
			COALESCE(SUM(sm.quantity * COALESCE(pv.cost_price, p.cost_price, ing.cost_per_unit, pi.cost_per_unit, 0)),0) AS wastage_value
		FROM stock_movements sm
		JOIN inventory_items ii ON ii.id = sm.inventory_item_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at < ? AND sm.movement_type = 'wastage'`
	summaryArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	summaryQuery, summaryArgs = addMovementFilters(summaryQuery, summaryArgs, filter)
	if err := r.db.Raw(summaryQuery, summaryArgs...).Scan(&summary).Error; err != nil {
		return nil, err
	}
	return &WastageReportResponse{TotalWastageQuantity: summary.TotalWastageQuantity, WastageValue: summary.WastageValue, Items: items}, nil
}

func (r *Repository) PackagingStock(filter *shared.ResolvedFilter) ([]PackagingStockReportItem, error) {
	items := []PackagingStockReportItem{}
	query := `
		SELECT p.id AS packaging_item_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE p.product_name END AS packaging_name,
			p.id AS product_id,
			pv.id AS product_variant_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE p.product_name END AS product_name,
			COALESCE(NULLIF(pv.sku, ''), p.product_code, '') AS product_code,
			pc.category_name,
			b.branch_name,
			ii.current_quantity, ii.available_quantity, ii.reorder_level,
			u.symbol AS unit_symbol,
			COALESCE(pv.cost_price, p.cost_price, ii.average_unit_cost, 0) AS cost_per_unit,
			COALESCE(ii.inventory_value, ii.current_quantity * COALESCE(pv.cost_price, p.cost_price, ii.average_unit_cost, 0)) AS stock_value,
			(ii.available_quantity <= ii.reorder_level) AS is_low_stock
		FROM inventory_items ii
		JOIN products p ON p.id = ii.product_id AND p.product_type = 'packaging' AND p.deleted_at IS NULL
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id AND pv.deleted_at IS NULL
		LEFT JOIN product_categories pc ON pc.id = p.category_id
		JOIN branches b ON b.id = ii.branch_id
		JOIN units u ON u.id = ii.unit_id
		WHERE ii.business_id = ? AND ii.item_type IN ('product', 'product_variant') AND ii.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	query += " ORDER BY packaging_name ASC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) InventoryAudit(filter *shared.ResolvedFilter) ([]InventoryAuditReportItem, int64, error) {
	items := []InventoryAuditReportItem{}
	query := `
		SELECT ii.id AS inventory_item_id,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			b.branch_name, ii.current_quantity,
			COALESCE(SUM(CASE WHEN sm.movement_direction = 'in' THEN sm.quantity WHEN sm.movement_direction = 'out' THEN -sm.quantity ELSE 0 END),0) AS calculated_quantity_from_movements,
			(ii.current_quantity - COALESCE(SUM(CASE WHEN sm.movement_direction = 'in' THEN sm.quantity WHEN sm.movement_direction = 'out' THEN -sm.quantity ELSE 0 END),0)) AS difference,
			ABS(ii.current_quantity - COALESCE(SUM(CASE WHEN sm.movement_direction = 'in' THEN sm.quantity WHEN sm.movement_direction = 'out' THEN -sm.quantity ELSE 0 END),0)) < 0.0001 AS is_balanced
		FROM inventory_items ii
		JOIN branches b ON b.id = ii.branch_id
		LEFT JOIN stock_movements sm ON sm.inventory_item_id = ii.id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id
		WHERE ii.business_id = ? AND ii.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	query += " GROUP BY ii.id, item_name, b.branch_name, ii.current_quantity ORDER BY is_balanced ASC, item_name ASC LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countInventoryItems(filter)
	return items, total, err
}

func (r *Repository) InventoryTrend(filter *shared.ResolvedFilter) ([]trendSeriesRow, error) {
	rows := []trendSeriesRow{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(CASE WHEN sm.movement_direction = 'in' THEN sm.quantity ELSE 0 END),0) AS net_sales,
			COALESCE(SUM(CASE WHEN sm.movement_direction = 'out' THEN sm.quantity ELSE 0 END),0) AS sales_count
		FROM stock_movements sm
		WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at < ?`, dateTrunc(filter.GroupBy, "sm.created_at"))
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addMovementFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) ManufacturingReportSummary(filter *shared.ResolvedFilter) (*ManufacturingReportSummaryResponse, error) {
	var row ManufacturingReportSummaryResponse
	query := `
		SELECT COUNT(*) AS total_batches,
			COUNT(*) FILTER (WHERE pb.status = 'completed') AS completed_batches,
			COUNT(*) FILTER (WHERE pb.status = 'cancelled') AS cancelled_batches,
			COALESCE(SUM(pb.planned_quantity),0) AS total_planned_quantity,
			COALESCE(SUM(pb.produced_quantity),0) AS total_produced_quantity,
			COALESCE(SUM(pb.wastage_quantity),0) AS total_wastage_quantity,
			COALESCE(SUM(pb.total_production_cost),0) AS estimated_production_cost
		FROM production_batches pb
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.TotalPlannedQuantity > 0 {
		row.YieldEfficiencyPercentage = (row.TotalProducedQuantity / row.TotalPlannedQuantity) * 100
	}
	return &row, nil
}

func (r *Repository) ManufacturingBatches(filter *shared.ResolvedFilter) ([]ManufacturingBatchReportItem, int64, error) {
	sortBy := safeSort(filter.SortBy, map[string]string{"produced_quantity": "pb.produced_quantity", "efficiency": "yield_efficiency_percentage", "created_at": "pb.created_at"}, "created_at")
	items := []ManufacturingBatchReportItem{}
	query := `
		SELECT pb.id AS batch_id,
			pb.production_batch_number AS batch_number,
			p.product_name,
			r.recipe_name,
			b.branch_name,
			pb.planned_quantity,
			pb.produced_quantity,
			(pb.produced_quantity - pb.planned_quantity) AS yield_variance,
			CASE WHEN pb.planned_quantity > 0 THEN (pb.produced_quantity / pb.planned_quantity) * 100 ELSE 0 END AS yield_efficiency_percentage,
			pb.status,
			COALESCE(pb.started_at, pb.created_at)::text AS start_time,
			COALESCE(pb.completed_at, pb.updated_at)::text AS end_time
		FROM production_batches pb
		JOIN products p ON p.id = pb.product_id
		JOIN recipes r ON r.id = pb.recipe_id
		JOIN branches b ON b.id = pb.branch_id
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	query += " ORDER BY " + sortBy + " " + filter.SortOrder + " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countProductionBatches(filter)
	return items, total, err
}

func (r *Repository) ManufacturingIngredientConsumption(filter *shared.ResolvedFilter) ([]IngredientConsumptionReportItem, error) {
	items := []IngredientConsumptionReportItem{}
	query := `
		SELECT pic.inventory_item_id,
			pic.item_name_snapshot AS ingredient_name,
			b.branch_name,
			COALESCE(SUM(pic.actual_quantity),0) AS total_consumed_quantity,
			u.symbol AS unit_symbol,
			COALESCE(SUM(pic.total_cost),0) AS estimated_cost,
			COUNT(DISTINCT pb.id) AS batch_count
		FROM production_ingredient_consumptions pic
		JOIN production_batches pb ON pb.id = pic.production_batch_id
		JOIN branches b ON b.id = pb.branch_id
		JOIN units u ON u.id = pic.unit_id
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	query += " GROUP BY pic.inventory_item_id, pic.item_name_snapshot, b.branch_name, u.symbol ORDER BY total_consumed_quantity DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ManufacturingYieldVariance(filter *shared.ResolvedFilter) ([]YieldVarianceReportItem, error) {
	items := []YieldVarianceReportItem{}
	query := `
		SELECT pb.production_batch_number AS batch_number,
			p.product_name,
			pb.planned_quantity,
			pb.produced_quantity,
			(pb.produced_quantity - pb.planned_quantity) AS variance_quantity,
			CASE WHEN pb.planned_quantity > 0 THEN ((pb.produced_quantity - pb.planned_quantity) / pb.planned_quantity) * 100 ELSE 0 END AS variance_percentage,
			b.branch_name
		FROM production_batches pb
		JOIN products p ON p.id = pb.product_id
		JOIN branches b ON b.id = pb.branch_id
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	query += " ORDER BY ABS(pb.produced_quantity - pb.planned_quantity) DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ManufacturingWastage(filter *shared.ResolvedFilter) (*ManufacturingWastageReportResponse, error) {
	items := []ManufacturingWastageReportItem{}
	batchQuery := `
		SELECT p.product_name AS item_name,
			'batch_wastage' AS wastage_type,
			pb.wastage_quantity AS quantity,
			u.symbol AS unit_symbol,
			COALESCE(pb.wastage_reason,'') AS reason,
			pb.production_batch_number AS batch_number,
			COALESCE(pb.completed_at, pb.updated_at)::text AS created_at
		FROM production_batches pb
		JOIN products p ON p.id = pb.product_id
		JOIN units u ON u.id = pb.yield_unit_id
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL AND pb.wastage_quantity > 0`
	batchArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	batchQuery, batchArgs = addManufacturingFilters(batchQuery, batchArgs, filter)
	ingredientQuery := `
		SELECT pic.item_name_snapshot AS item_name,
			'ingredient_wastage' AS wastage_type,
			pic.wastage_quantity AS quantity,
			u.symbol AS unit_symbol,
			COALESCE(pb.wastage_reason,'') AS reason,
			pb.production_batch_number AS batch_number,
			pic.updated_at::text AS created_at
		FROM production_ingredient_consumptions pic
		JOIN production_batches pb ON pb.id = pic.production_batch_id
		JOIN units u ON u.id = pic.unit_id
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL AND pic.wastage_quantity > 0`
	ingredientArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	ingredientQuery, ingredientArgs = addManufacturingFilters(ingredientQuery, ingredientArgs, filter)
	query := batchQuery + " UNION ALL " + ingredientQuery + " ORDER BY created_at DESC"
	args := append(batchArgs, ingredientArgs...)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	var summary struct {
		TotalWastageQuantity float64
		EstimatedWastageCost float64
	}
	summaryQuery := `
		SELECT COALESCE(SUM(quantity),0) AS total_wastage_quantity,
			COALESCE(SUM(estimated_cost),0) AS estimated_wastage_cost
		FROM (`
	batchCostQuery := `
			SELECT pb.wastage_quantity AS quantity,
				(pb.wastage_quantity * pb.cost_per_unit) AS estimated_cost
			FROM production_batches pb
			WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL AND pb.wastage_quantity > 0`
	batchCostArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	batchCostQuery, batchCostArgs = addManufacturingFilters(batchCostQuery, batchCostArgs, filter)
	ingredientCostQuery := `
			SELECT pic.wastage_quantity AS quantity,
				(pic.wastage_quantity * pic.unit_cost_snapshot) AS estimated_cost
			FROM production_ingredient_consumptions pic
			JOIN production_batches pb ON pb.id = pic.production_batch_id
			WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL AND pic.wastage_quantity > 0`
	ingredientCostArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	ingredientCostQuery, ingredientCostArgs = addManufacturingFilters(ingredientCostQuery, ingredientCostArgs, filter)
	summaryQuery += batchCostQuery + " UNION ALL " + ingredientCostQuery + ") wastage_totals"
	summaryArgs := append(batchCostArgs, ingredientCostArgs...)
	if err := r.db.Raw(summaryQuery, summaryArgs...).Scan(&summary).Error; err != nil {
		return nil, err
	}
	return &ManufacturingWastageReportResponse{TotalWastageQuantity: summary.TotalWastageQuantity, EstimatedWastageCost: summary.EstimatedWastageCost, Items: items}, nil
}

func (r *Repository) ManufacturingRecipeCosts(filter *shared.ResolvedFilter) ([]RecipeCostReportItem, error) {
	items := []RecipeCostReportItem{}
	query := `
		SELECT r.id AS recipe_id,
			r.recipe_name,
			p.product_name,
			r.estimated_ingredient_cost,
			r.estimated_packaging_cost,
			r.estimated_total_cost,
			r.cost_per_yield_unit,
			r.batch_yield_quantity,
			r.version_number,
			r.is_active
		FROM recipes r
		JOIN products p ON p.id = r.product_id
		WHERE r.business_id = ? AND r.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID}
	if !filter.AllBranches {
		query += " AND r.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.ProductID != "" {
		query += " AND r.product_id = ?"
		args = append(args, filter.ProductID)
	}
	if filter.RecipeID != "" {
		query += " AND r.id = ?"
		args = append(args, filter.RecipeID)
	}
	query += " ORDER BY r.is_active DESC, r.recipe_name ASC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ManufacturingTrend(filter *shared.ResolvedFilter) ([]trendSeriesRow, error) {
	rows := []trendSeriesRow{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(pb.produced_quantity),0) AS net_sales,
			COALESCE(SUM(pb.wastage_quantity),0) AS sales_count
		FROM production_batches pb
		WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "pb.production_date"))
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) BakeryOrdersSummary(filter *shared.ResolvedFilter) (*BakeryOrdersReportSummaryResponse, error) {
	var row BakeryOrdersReportSummaryResponse
	query := `
		SELECT COUNT(*) AS total_orders,
			COUNT(*) FILTER (WHERE bo.order_status IN ('new','confirmed')) AS pending_orders,
			COUNT(*) FILTER (WHERE bo.order_status = 'in_production') AS in_production_orders,
			COUNT(*) FILTER (WHERE bo.order_status = 'ready') AS ready_orders,
			COUNT(*) FILTER (WHERE bo.order_status = 'completed') AS completed_orders,
			COUNT(*) FILTER (WHERE bo.order_status = 'cancelled') AS cancelled_orders,
			COUNT(*) FILTER (WHERE bo.order_type = 'pickup') AS pickup_orders,
			COUNT(*) FILTER (WHERE bo.order_type = 'delivery') AS delivery_orders,
			COALESCE(SUM(bo.total_amount),0) AS total_order_value,
			COALESCE(SUM(bo.paid_amount),0) AS paid_amount,
			COALESCE(SUM(bo.balance_amount),0) AS balance_pending
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) BakeryOrdersUpcoming(filter *shared.ResolvedFilter) ([]UpcomingBakeryOrderReportItem, int64, error) {
	items := []UpcomingBakeryOrderReportItem{}
	endDate := filter.DateTo.Format("2006-01-02")
	if filter.UpcomingDays > 0 {
		endDate = filter.DateFrom.AddDate(0, 0, filter.UpcomingDays).Format("2006-01-02")
	}
	query := `
		SELECT bo.id AS order_id,
			bo.order_number,
			COALESCE(bo.customer_name_snapshot,'') AS customer_name,
			bo.event_date::text AS event_date,
			bo.pickup_time,
			bo.delivery_time,
			bo.order_type,
			bo.order_status,
			bo.total_amount,
			bo.balance_amount
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), endDate}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " ORDER BY bo.event_date ASC, COALESCE(bo.pickup_time, bo.delivery_time, '') ASC LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	total, err := r.countBakeryOrdersBetween(filter, filter.DateFrom.Format("2006-01-02"), endDate)
	return items, total, err
}

func (r *Repository) BakeryOrdersStatus(filter *shared.ResolvedFilter) ([]BakeryOrderStatusReportItem, error) {
	items := []BakeryOrderStatusReportItem{}
	query := `
		SELECT bo.order_status,
			COUNT(*) AS orders_count,
			COALESCE(SUM(bo.total_amount),0) AS total_order_value
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " GROUP BY bo.order_status ORDER BY orders_count DESC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) BakeryOrdersProductionSchedule(filter *shared.ResolvedFilter) ([]BakeryOrderProductionScheduleItem, error) {
	items := []BakeryOrderProductionScheduleItem{}
	query := `
		SELECT bo.order_number,
			boi.product_name_snapshot AS product_name,
			bo.event_date::text AS event_date,
			COALESCE(bop.status,'pending') AS production_status,
			pb.production_batch_number AS assigned_batch_number,
			boi.quantity,
			b.branch_name
		FROM bakery_orders bo
		JOIN bakery_order_items boi ON boi.bakery_order_id = bo.id AND boi.deleted_at IS NULL
		JOIN branches b ON b.id = bo.branch_id
		LEFT JOIN bakery_order_productions bop ON bop.bakery_order_id = bo.id
		LEFT JOIN production_batches pb ON pb.id = bop.production_batch_id
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL
			AND bo.order_status IN ('confirmed','in_production','ready')`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " ORDER BY bo.event_date ASC, bo.order_number ASC"
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) BakeryOrdersPendingPayments(filter *shared.ResolvedFilter) (*BakeryOrderPendingPaymentsResponse, error) {
	items := []BakeryOrderPendingPaymentItem{}
	query := `
		SELECT bo.order_number,
			COALESCE(bo.customer_name_snapshot,'') AS customer_name,
			bo.total_amount,
			bo.paid_amount,
			bo.balance_amount,
			bo.payment_status,
			bo.event_date::text AS event_date
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL
			AND bo.payment_status IN ('unpaid','partial')`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " ORDER BY bo.event_date ASC, bo.balance_amount DESC LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	var totalPending float64
	summaryQuery := "SELECT COALESCE(SUM(bo.balance_amount),0) FROM bakery_orders bo WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL AND bo.payment_status IN ('unpaid','partial')"
	summaryArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	summaryQuery, summaryArgs = addBakeryOrderFilters(summaryQuery, summaryArgs, filter)
	if err := r.db.Raw(summaryQuery, summaryArgs...).Scan(&totalPending).Error; err != nil {
		return nil, err
	}
	return &BakeryOrderPendingPaymentsResponse{TotalPendingBalance: totalPending, Orders: items}, nil
}

func (r *Repository) BakeryOrdersDeliveryVsPickup(filter *shared.ResolvedFilter) (*BakeryOrderDeliveryVsPickupResponse, error) {
	rows := []struct {
		OrderType  string
		Count      int64
		TotalValue float64
	}{}
	query := `
		SELECT bo.order_type,
			COUNT(*) AS count,
			COALESCE(SUM(bo.total_amount),0) AS total_value
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " GROUP BY bo.order_type"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	response := &BakeryOrderDeliveryVsPickupResponse{}
	for _, row := range rows {
		summary := BakeryOrderTypeSummary{Count: row.Count, TotalValue: row.TotalValue}
		if row.OrderType == "delivery" {
			response.DeliveryOrders = summary
		} else if row.OrderType == "pickup" {
			response.PickupOrders = summary
		}
	}
	return response, nil
}

func (r *Repository) BakeryOrdersTrend(filter *shared.ResolvedFilter) ([]trendSeriesRow, error) {
	rows := []trendSeriesRow{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(bo.total_amount),0) AS net_sales,
			COUNT(*)::numeric AS sales_count
		FROM bakery_orders bo
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "bo.event_date"))
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBakeryOrderFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) FinancialSummary(filter *shared.ResolvedFilter) (*FinancialSummaryResponse, error) {
	row := &FinancialSummaryResponse{}
	posGrossQuery := "SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE business_id = ? AND sold_at >= ? AND sold_at < ? AND sale_status <> 'voided' AND deleted_at IS NULL"
	posGrossArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	posGrossQuery, posGrossArgs = addBranchCondition(posGrossQuery, posGrossArgs, filter)
	var posGross float64
	if err := r.db.Raw(posGrossQuery, posGrossArgs...).Scan(&posGross).Error; err != nil {
		return nil, err
	}
	bakeryGrossQuery := "SELECT COALESCE(SUM(total_amount),0) FROM bakery_orders WHERE business_id = ? AND event_date >= ? AND event_date <= ? AND order_status <> 'cancelled' AND deleted_at IS NULL"
	bakeryGrossArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	bakeryGrossQuery, bakeryGrossArgs = addBranchCondition(bakeryGrossQuery, bakeryGrossArgs, filter)
	var bakeryGross float64
	if err := r.db.Raw(bakeryGrossQuery, bakeryGrossArgs...).Scan(&bakeryGross).Error; err != nil {
		return nil, err
	}
	row.GrossSales = posGross + bakeryGross

	var collected struct {
		TotalCollected        float64
		PaymentCount          int64
		CashCollected         float64
		CardCollected         float64
		BankTransferCollected float64
	}
	collectedQuery, collectedArgs := financialCollectedSummarySQL(filter)
	if err := r.db.Raw(collectedQuery, collectedArgs...).Scan(&collected).Error; err != nil {
		return nil, err
	}
	row.TotalCollected = collected.TotalCollected
	row.PaymentCount = collected.PaymentCount
	row.CashCollected = collected.CashCollected
	row.CardCollected = collected.CardCollected
	row.BankTransferCollected = collected.BankTransferCollected

	refundQuery := "SELECT COALESCE(SUM(refund_amount),0) AS total_refunded, COUNT(*) AS refund_count FROM payment_refunds WHERE business_id = ? AND refunded_at >= ? AND refunded_at < ? AND refund_status = 'completed' AND deleted_at IS NULL"
	refundArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	refundQuery, refundArgs = addBranchCondition(refundQuery, refundArgs, filter)
	if err := r.db.Raw(refundQuery, refundArgs...).Scan(row).Error; err != nil {
		return nil, err
	}
	row.NetCollected = row.TotalCollected - row.TotalRefunded

	outstandingQuery, outstandingArgs := financialOutstandingSummarySQL(filter)
	if err := r.db.Raw(outstandingQuery, outstandingArgs...).Scan(&row.OutstandingCustomerBalance).Error; err != nil {
		return nil, err
	}
	purchaseQuery := "SELECT COALESCE(SUM(total_amount),0) AS purchase_total, COALESCE(SUM(balance_amount),0) AS supplier_payable_balance FROM purchase_invoices WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ? AND status = 'posted' AND deleted_at IS NULL"
	purchaseArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	purchaseQuery, purchaseArgs = addBranchCondition(purchaseQuery, purchaseArgs, filter)
	if err := r.db.Raw(purchaseQuery, purchaseArgs...).Scan(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func (r *Repository) FinancialPayments(filter *shared.ResolvedFilter) ([]FinancialPaymentReportItem, int64, error) {
	items := []FinancialPaymentReportItem{}
	unionQuery, args := financialPaymentsUnionSQL(filter)
	query := "SELECT * FROM (" + unionQuery + ") financial_payments ORDER BY paid_at DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, queryArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	countQuery := "SELECT COUNT(*) FROM (" + unionQuery + ") financial_payments"
	if err := r.db.Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FinancialByPaymentMethod(filter *shared.ResolvedFilter) ([]FinancialPaymentMethodReportItem, error) {
	items := []FinancialPaymentMethodReportItem{}
	query, args := financialPaymentsByMethodSQL(filter)
	if err := r.db.Raw(query, args...).Scan(&items).Error; err != nil {
		return nil, err
	}
	for i := range items {
		items[i].NetCollected = items[i].TotalCollected - items[i].TotalRefunded
	}
	return items, nil
}

func (r *Repository) FinancialRefunds(filter *shared.ResolvedFilter) ([]FinancialRefundReportItem, int64, error) {
	items := []FinancialRefundReportItem{}
	query := `
		SELECT pr.id AS refund_id,
			COALESCE(pr.refund_source, 'payment_adjustment') AS refund_source,
			CASE WHEN COALESCE(pr.refund_source, 'payment_adjustment') = 'sales_return' THEN 'sales_return' ELSE 'pos_sale' END AS source_type,
			CASE WHEN COALESCE(pr.refund_source, 'payment_adjustment') = 'sales_return' THEN COALESCE(sr.return_number, '') ELSE s.sale_number END AS source_number,
			s.sale_number,
			pr.sales_return_id,
			COALESCE(sr.return_number, '') AS sales_return_number,
			b.branch_name,
			pr.payment_method_name_snapshot AS payment_method_name,
			pr.refund_amount,
			pr.refund_reason,
			pr.refund_status,
			u.full_name AS created_by_user_name,
			pr.refunded_at::text AS refunded_at
		FROM payment_refunds pr
		JOIN sales s ON s.id = pr.sale_id
		JOIN branches b ON b.id = pr.branch_id
		LEFT JOIN sales_returns sr ON sr.id = pr.sales_return_id AND sr.business_id = pr.business_id
		LEFT JOIN users u ON u.id = pr.created_by_user_id
		WHERE pr.business_id = ? AND pr.refunded_at >= ? AND pr.refunded_at < ? AND pr.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		query += " AND pr.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		query += " AND pr.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	query += " ORDER BY pr.refunded_at DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, queryArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	countQuery := "SELECT COUNT(*) FROM payment_refunds pr WHERE pr.business_id = ? AND pr.refunded_at >= ? AND pr.refunded_at < ? AND pr.deleted_at IS NULL"
	countArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		countQuery += " AND pr.branch_id = ?"
		countArgs = append(countArgs, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		countQuery += " AND pr.payment_method_id = ?"
		countArgs = append(countArgs, filter.PaymentMethodID)
	}
	if err := r.db.Raw(countQuery, countArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FinancialOutstandingBalances(filter *shared.ResolvedFilter) ([]OutstandingBalanceReportItem, int64, error) {
	items := []OutstandingBalanceReportItem{}
	query, args := financialOutstandingRowsSQL(filter)
	paged := "SELECT * FROM (" + query + ") outstanding ORDER BY due_date ASC, balance_amount DESC LIMIT ? OFFSET ?"
	pagedArgs := append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(paged, pagedArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	if err := r.db.Raw("SELECT COUNT(*) FROM ("+query+") outstanding", args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FinancialSupplierPayables(filter *shared.ResolvedFilter) ([]SupplierPayableReportItem, int64, error) {
	items := []SupplierPayableReportItem{}
	creditBranchFilter := ""
	creditArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	if !filter.AllBranches {
		creditBranchFilter = " AND branch_id = ?"
		creditArgs = append(creditArgs, filter.BranchID)
	}
	query := `
		SELECT pi.supplier_id,
			s.supplier_name,
			COUNT(*) AS invoice_count,
			COALESCE(SUM(pi.total_amount),0) AS total_invoice_amount,
			COALESCE(SUM(pi.paid_amount),0) AS paid_amount,
			COALESCE(SUM(pi.balance_amount),0) AS payable_balance,
			COALESCE(MAX(vc.open_credit_amount),0) AS open_credit_amount,
			MIN(pi.due_date)::text AS oldest_due_date
		FROM purchase_invoices pi
		JOIN suppliers s ON s.id = pi.supplier_id
		LEFT JOIN (
			SELECT supplier_id, COALESCE(SUM(open_credit_amount),0) AS open_credit_amount
			FROM purchase_returns
			WHERE business_id = ? AND return_date >= ? AND return_date <= ? AND status = 'posted' AND deleted_at IS NULL` + creditBranchFilter + `
			GROUP BY supplier_id
		) vc ON vc.supplier_id = pi.supplier_id
		WHERE pi.business_id = ? AND pi.invoice_date >= ? AND pi.invoice_date <= ? AND pi.status <> 'cancelled' AND pi.payment_status IN ('unpaid','partial','overdue') AND pi.deleted_at IS NULL`
	args := append(creditArgs, filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02"))
	if !filter.AllBranches {
		query += " AND pi.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	query += " GROUP BY pi.supplier_id, s.supplier_name ORDER BY payable_balance DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, queryArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	countQuery := "SELECT COUNT(*) FROM (SELECT pi.supplier_id FROM purchase_invoices pi WHERE pi.business_id = ? AND pi.invoice_date >= ? AND pi.invoice_date <= ? AND pi.status <> 'cancelled' AND pi.payment_status IN ('unpaid','partial','overdue') AND pi.deleted_at IS NULL"
	countArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	countQuery, countArgs = addBranchCondition(countQuery, countArgs, filter)
	countQuery += " GROUP BY pi.supplier_id) supplier_count"
	if err := r.db.Raw(countQuery, countArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FinancialPurchaseTotals(filter *shared.ResolvedFilter) (*PurchaseTotalsReportResponse, error) {
	var result PurchaseTotalsReportResponse
	query := "SELECT COALESCE(SUM(total_amount),0) AS total_purchase_amount, COALESCE(SUM(paid_amount),0) AS paid_purchase_amount, COALESCE(SUM(balance_amount),0) AS unpaid_purchase_amount, COUNT(*) AS invoice_count FROM purchase_invoices WHERE business_id = ? AND invoice_date >= ? AND invoice_date <= ? AND status = 'posted' AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBranchCondition(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&result).Error; err != nil {
		return nil, err
	}
	bySupplier := []PurchaseTotalsBySupplier{}
	supplierQuery := "SELECT pi.supplier_id, s.supplier_name, COALESCE(SUM(pi.total_amount),0) AS total_purchase_amount, COUNT(*) AS invoice_count FROM purchase_invoices pi JOIN suppliers s ON s.id = pi.supplier_id WHERE pi.business_id = ? AND pi.invoice_date >= ? AND pi.invoice_date <= ? AND pi.status = 'posted' AND pi.deleted_at IS NULL"
	supplierArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	if !filter.AllBranches {
		supplierQuery += " AND pi.branch_id = ?"
		supplierArgs = append(supplierArgs, filter.BranchID)
	}
	supplierQuery += " GROUP BY pi.supplier_id, s.supplier_name ORDER BY total_purchase_amount DESC"
	if err := r.db.Raw(supplierQuery, supplierArgs...).Scan(&bySupplier).Error; err != nil {
		return nil, err
	}
	result.BySupplier = bySupplier
	return &result, nil
}

func (r *Repository) FinancialReconciliation(filter *shared.ResolvedFilter) ([]ReconciliationReportItem, int64, error) {
	items := []ReconciliationReportItem{}
	query := `
		SELECT pr.id AS reconciliation_id,
			b.branch_name,
			pm.method_name AS payment_method_name,
			pr.reconciliation_date::text AS reconciliation_date,
			pr.expected_amount,
			pr.counted_amount,
			pr.difference_amount,
			pr.status,
			u.full_name AS created_by_user_name
		FROM payment_reconciliations pr
		JOIN branches b ON b.id = pr.branch_id
		JOIN payment_methods pm ON pm.id = pr.payment_method_id
		LEFT JOIN users u ON u.id = pr.created_by_user_id
		WHERE pr.business_id = ? AND pr.reconciliation_date >= ? AND pr.reconciliation_date <= ? AND pr.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addFinancialReconciliationFilters(query, args, filter)
	query += " ORDER BY pr.reconciliation_date DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, filter.Limit, (filter.Page-1)*filter.Limit)
	if err := r.db.Raw(query, queryArgs...).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	countQuery := "SELECT COUNT(*) FROM payment_reconciliations pr WHERE pr.business_id = ? AND pr.reconciliation_date >= ? AND pr.reconciliation_date <= ? AND pr.deleted_at IS NULL"
	countArgs := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	countQuery, countArgs = addFinancialReconciliationFilters(countQuery, countArgs, filter)
	if err := r.db.Raw(countQuery, countArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FinancialTrend(filter *shared.ResolvedFilter) ([]trendSeriesRow, error) {
	rows := []trendSeriesRow{}
	query, args := financialTrendSQL(filter)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) salesSummary(filter *shared.ResolvedFilter) (*SalesSummary, error) {
	var row SalesSummary
	query := "SELECT COALESCE(SUM(total_amount),0) AS total_sales, COUNT(*) AS sales_count, COALESCE(AVG(total_amount),0) AS average_order_value FROM sales WHERE business_id = ? AND sold_at >= ? AND sold_at < ? AND sale_status <> 'voided' AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addBranchCondition(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&row).Error
	return &row, err
}

func (r *Repository) salesReportSummaryForRange(filter *shared.ResolvedFilter, startUTC, endUTC time.Time) (*SalesReportSummaryResponse, error) {
	var row salesSummarySQLRow
	query := `
		SELECT COALESCE(SUM(s.subtotal_amount),0) AS gross_sales,
			COALESCE(SUM(s.total_amount),0) AS net_sales,
			COUNT(DISTINCT s.id) AS sales_count,
			COALESCE(SUM(si.quantity),0) AS items_sold,
			COALESCE(SUM(s.discount_amount),0) + COALESCE(SUM(si.discount_amount),0) AS discount_total,
			COALESCE(SUM(s.tax_amount),0) AS tax_total
		FROM sales s
		LEFT JOIN sale_items si ON si.sale_id = s.id
		LEFT JOIN products p ON p.id = si.product_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, startUTC, endUTC}
	query, args = addSalesFilters(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&row).Error; err != nil {
		return nil, err
	}
	returnTotal, err := r.salesReturnTotalForRange(filter, startUTC, endUTC)
	if err != nil {
		return nil, err
	}
	var voidCount int64
	voidQuery := "SELECT COUNT(*) FROM sales s WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status = 'voided' AND s.deleted_at IS NULL"
	voidArgs := []interface{}{filter.BusinessID, startUTC, endUTC}
	voidQuery, voidArgs = addHeaderSalesFilters(voidQuery, voidArgs, filter)
	if err := r.db.Raw(voidQuery, voidArgs...).Scan(&voidCount).Error; err != nil {
		return nil, err
	}
	response := &SalesReportSummaryResponse{
		GrossSales:       row.GrossSales,
		NetSales:         row.NetSales - returnTotal,
		SalesCount:       row.SalesCount,
		ItemsSold:        row.ItemsSold,
		DiscountTotal:    row.DiscountTotal,
		TaxTotal:         row.TaxTotal,
		RefundTotal:      returnTotal,
		VoidedSalesCount: voidCount,
	}
	if response.SalesCount > 0 {
		response.AverageOrderValue = response.NetSales / float64(response.SalesCount)
	}
	return response, nil
}

func (r *Repository) inventorySummary(filter *shared.ResolvedFilter) (*InventorySummary, error) {
	var lowStock int64
	query := "SELECT COUNT(*) FROM inventory_items WHERE business_id = ? AND status = 'active' AND deleted_at IS NULL AND available_quantity <= reorder_level"
	args := []interface{}{filter.BusinessID}
	query, args = addBranchCondition(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&lowStock).Error; err != nil {
		return nil, err
	}
	var expiring int64
	expiryQuery := "SELECT COUNT(*) FROM expiry_batches WHERE business_id = ? AND status = 'active' AND deleted_at IS NULL AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'"
	expiryArgs := []interface{}{filter.BusinessID}
	expiryQuery, expiryArgs = addBranchCondition(expiryQuery, expiryArgs, filter)
	if err := r.db.Raw(expiryQuery, expiryArgs...).Scan(&expiring).Error; err != nil {
		return nil, err
	}
	return &InventorySummary{LowStockCount: lowStock, ExpiringItemsCount: expiring}, nil
}

func (r *Repository) manufacturingSummary(filter *shared.ResolvedFilter) (*ManufacturingSummary, error) {
	var row ManufacturingSummary
	query := "SELECT COUNT(*) FILTER (WHERE status IN ('draft','planned','in_progress')) AS active_batches, COUNT(*) FILTER (WHERE status = 'completed') AS completed_batches FROM production_batches WHERE business_id = ? AND production_date >= ? AND production_date <= ? AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBranchCondition(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&row).Error
	return &row, err
}

func (r *Repository) ordersSummary(filter *shared.ResolvedFilter) (*OrdersSummary, error) {
	var row OrdersSummary
	query := "SELECT COUNT(*) FILTER (WHERE order_status IN ('new','confirmed')) AS pending_orders, COUNT(*) FILTER (WHERE order_status = 'ready') AS ready_orders FROM bakery_orders WHERE business_id = ? AND event_date >= ? AND event_date <= ? AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBranchCondition(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&row).Error
	return &row, err
}

func (r *Repository) paymentsSummary(filter *shared.ResolvedFilter) (*PaymentsSummary, error) {
	var collected float64
	query := "SELECT COALESCE(SUM(amount),0) FROM sale_payments WHERE business_id = ? AND paid_at >= ? AND paid_at < ? AND payment_status IN ('completed','partially_refunded','refunded') AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addBranchCondition(query, args, filter)
	if err := r.db.Raw(query, args...).Scan(&collected).Error; err != nil {
		return nil, err
	}
	var refunded float64
	refundQuery := "SELECT COALESCE(SUM(refund_amount),0) FROM payment_refunds WHERE business_id = ? AND refunded_at >= ? AND refunded_at < ? AND refund_status = 'completed' AND deleted_at IS NULL"
	refundArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	refundQuery, refundArgs = addBranchCondition(refundQuery, refundArgs, filter)
	if err := r.db.Raw(refundQuery, refundArgs...).Scan(&refunded).Error; err != nil {
		return nil, err
	}
	return &PaymentsSummary{CollectedAmount: collected, RefundAmount: refunded}, nil
}

func (r *Repository) salesExportRows(filter *shared.ResolvedFilter) ([]string, [][]string, error) {
	rows := []struct {
		SaleNumber    string
		SoldAt        time.Time
		SaleStatus    string
		PaymentStatus string
		TotalAmount   float64
		PaidAmount    float64
	}{}
	query := "SELECT sale_number, sold_at, sale_status, payment_status, total_amount, paid_amount FROM sales WHERE business_id = ? AND sold_at >= ? AND sold_at < ? AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addBranchCondition(query, args, filter)
	query += " ORDER BY sold_at DESC LIMIT ?"
	args = append(args, filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, nil, err
	}
	out := make([][]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, []string{row.SaleNumber, row.SoldAt.Format(time.RFC3339), row.SaleStatus, row.PaymentStatus, fmtFloat(row.TotalAmount), fmtFloat(row.PaidAmount)})
	}
	return []string{"sale_number", "sold_at", "sale_status", "payment_status", "total_amount", "paid_amount"}, out, nil
}

func (r *Repository) paymentsExportRows(filter *shared.ResolvedFilter) ([]string, [][]string, error) {
	rows := []struct {
		Method string
		PaidAt time.Time
		Status string
		Amount float64
	}{}
	query := "SELECT payment_method_name_snapshot AS method, paid_at, payment_status AS status, amount FROM sale_payments WHERE business_id = ? AND paid_at >= ? AND paid_at < ? AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addBranchCondition(query, args, filter)
	query += " ORDER BY paid_at DESC LIMIT ?"
	args = append(args, filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, nil, err
	}
	out := make([][]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, []string{row.Method, row.PaidAt.Format(time.RFC3339), row.Status, fmtFloat(row.Amount)})
	}
	return []string{"payment_method", "paid_at", "payment_status", "amount"}, out, nil
}

func (r *Repository) ordersExportRows(filter *shared.ResolvedFilter) ([]string, [][]string, error) {
	rows := []struct {
		OrderNumber   string
		EventDate     time.Time
		OrderStatus   string
		PaymentStatus string
		TotalAmount   float64
		BalanceAmount float64
	}{}
	query := "SELECT order_number, event_date, order_status, payment_status, total_amount, balance_amount FROM bakery_orders WHERE business_id = ? AND event_date >= ? AND event_date <= ? AND deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBranchCondition(query, args, filter)
	query += " ORDER BY event_date DESC LIMIT ?"
	args = append(args, filter.Limit)
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, nil, err
	}
	out := make([][]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, []string{row.OrderNumber, row.EventDate.Format("2006-01-02"), row.OrderStatus, row.PaymentStatus, fmtFloat(row.TotalAmount), fmtFloat(row.BalanceAmount)})
	}
	return []string{"order_number", "event_date", "order_status", "payment_status", "total_amount", "balance_amount"}, out, nil
}

func baseTimeSeriesQuery(dateColumn, aggregate, table, extraWhere string, filter *shared.ResolvedFilter) (string, []interface{}) {
	bucket := dateTrunc(filter.GroupBy, dateColumn)
	query := fmt.Sprintf("SELECT %s AS bucket, COALESCE(%s,0) AS value FROM %s WHERE business_id = ? AND %s >= ? AND %s < ? AND %s", bucket, aggregate, table, dateColumn, dateColumn, extraWhere)
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addBranchCondition(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	return query, args
}

func baseDateSeriesQuery(dateColumn, aggregate, table, extraWhere string, filter *shared.ResolvedFilter) (string, []interface{}) {
	bucket := dateTrunc(filter.GroupBy, dateColumn)
	query := fmt.Sprintf("SELECT %s AS bucket, COALESCE(%s,0) AS value FROM %s WHERE business_id = ? AND %s >= ? AND %s <= ? AND %s", bucket, aggregate, table, dateColumn, dateColumn, extraWhere)
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addBranchCondition(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	return query, args
}

func addBranchCondition(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND branch_id = ?"
		args = append(args, filter.BranchID)
	}
	return query, args
}

func inventoryItemSelect() string {
	return `
		SELECT ii.id AS inventory_item_id, ii.branch_id, b.branch_name, ii.item_type,
			CASE WHEN ii.item_type = 'product_variant' THEN CONCAT(p.product_name, ' - ', pv.variant_name) ELSE COALESCE(p.product_name, ing.ingredient_name, pi.packaging_name, '') END AS item_name,
			COALESCE(NULLIF(pv.sku, ''), p.product_code, ing.ingredient_code, pi.packaging_code, '') AS item_code,
			ii.current_quantity, ii.reserved_quantity, ii.available_quantity, ii.reorder_level,
			u.symbol AS unit_symbol, ii.status,
			(ii.available_quantity <= ii.reorder_level) AS is_low_stock,
			(ii.available_quantity <= 0) AS is_out_of_stock
		FROM inventory_items ii
		JOIN branches b ON b.id = ii.branch_id
		JOIN units u ON u.id = ii.unit_id
		LEFT JOIN products p ON p.id = ii.product_id
		LEFT JOIN product_variants pv ON pv.id = ii.product_variant_id
		LEFT JOIN ingredients ing ON ing.id = ii.ingredient_id
		LEFT JOIN packaging_items pi ON pi.id = ii.packaging_item_id`
}

func addInventoryItemFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND ii.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.ItemType != "" {
		query += " AND ii.item_type = ?"
		args = append(args, filter.ItemType)
	}
	if filter.Status != "" {
		query += " AND ii.status = ?"
		args = append(args, filter.Status)
	}
	return query, args
}

func addMovementFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND sm.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.ItemType != "" {
		query += " AND sm.item_type = ?"
		args = append(args, filter.ItemType)
	}
	if filter.MovementType != "" {
		query += " AND sm.movement_type = ?"
		args = append(args, filter.MovementType)
	}
	if filter.MovementDirection != "" {
		query += " AND sm.movement_direction = ?"
		args = append(args, filter.MovementDirection)
	}
	if filter.ReferenceType != "" {
		query += " AND sm.reference_type = ?"
		args = append(args, filter.ReferenceType)
	}
	return query, args
}

func addManufacturingFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND pb.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.ProductID != "" {
		query += " AND pb.product_id = ?"
		args = append(args, filter.ProductID)
	}
	if filter.RecipeID != "" {
		query += " AND pb.recipe_id = ?"
		args = append(args, filter.RecipeID)
	}
	if filter.BatchStatus != "" {
		query += " AND pb.status = ?"
		args = append(args, filter.BatchStatus)
	}
	return query, args
}

func addBakeryOrderFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND bo.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.CustomerID != "" {
		query += " AND bo.customer_id = ?"
		args = append(args, filter.CustomerID)
	}
	if filter.OrderStatus != "" {
		query += " AND bo.order_status = ?"
		args = append(args, filter.OrderStatus)
	}
	if filter.PaymentStatus != "" {
		query += " AND bo.payment_status = ?"
		args = append(args, filter.PaymentStatus)
	}
	if filter.OrderType != "" {
		query += " AND bo.order_type = ?"
		args = append(args, filter.OrderType)
	}
	return query, args
}

func addFinancialReconciliationFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND pr.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		query += " AND pr.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	if filter.Status != "" {
		query += " AND pr.status = ?"
		args = append(args, filter.Status)
	}
	return query, args
}

func financialPaymentsUnionSQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	pos := `
		SELECT sp.id AS payment_id,
			sp.payment_method_id,
			'pos_sale' AS source_type,
			s.sale_number AS source_number,
			b.branch_name,
			sp.payment_method_name_snapshot AS payment_method_name,
			COALESCE(NULLIF(sp.payment_method_type_snapshot,''), pm.method_type, '') AS payment_method_type,
			sp.amount,
			sp.payment_status AS status,
			sp.reference_number,
			COALESCE(u.full_name,'') AS paid_by_user_name,
			sp.paid_at::text AS paid_at
		FROM sale_payments sp
		JOIN sales s ON s.id = sp.sale_id
		JOIN branches b ON b.id = sp.branch_id
		LEFT JOIN payment_methods pm ON pm.id = sp.payment_method_id
		LEFT JOIN users u ON u.id = sp.paid_by_user_id
		WHERE sp.business_id = ? AND sp.paid_at >= ? AND sp.paid_at < ? AND sp.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		pos += " AND sp.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		pos += " AND sp.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	bakery := `
		SELECT bop.id AS payment_id,
			bop.payment_method_id,
			'bakery_order' AS source_type,
			bo.order_number AS source_number,
			b.branch_name,
			bop.payment_method_name_snapshot AS payment_method_name,
			COALESCE(pm.method_type, '') AS payment_method_type,
			bop.amount,
			'completed' AS status,
			bop.reference_number,
			COALESCE(u.full_name,'') AS paid_by_user_name,
			bop.paid_at::text AS paid_at
		FROM bakery_order_payments bop
		JOIN bakery_orders bo ON bo.id = bop.bakery_order_id
		JOIN branches b ON b.id = bo.branch_id
		LEFT JOIN payment_methods pm ON pm.id = bop.payment_method_id
		LEFT JOIN users u ON u.id = bop.paid_by_user_id
		WHERE bop.business_id = ? AND bop.paid_at >= ? AND bop.paid_at < ? AND bo.deleted_at IS NULL`
	args = append(args, filter.BusinessID, filter.StartUTC, filter.EndUTC)
	if !filter.AllBranches {
		bakery += " AND bo.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		bakery += " AND bop.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	return pos + " UNION ALL " + bakery, args
}

func financialCollectedSummarySQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	union, args := financialPaymentsUnionSQL(filter)
	return `
		SELECT COALESCE(SUM(amount),0) AS total_collected,
			COUNT(*) AS payment_count,
			COALESCE(SUM(amount) FILTER (WHERE payment_method_type = 'cash'),0) AS cash_collected,
			COALESCE(SUM(amount) FILTER (WHERE payment_method_type = 'card'),0) AS card_collected,
			COALESCE(SUM(amount) FILTER (WHERE payment_method_type = 'bank_transfer'),0) AS bank_transfer_collected
		FROM (` + union + `) collected
		WHERE status IN ('completed','partially_refunded','refunded')`, args
}

func financialPaymentsByMethodSQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	union, args := financialPaymentsUnionSQL(filter)
	refund := `
		SELECT payment_method_id,
			COALESCE(SUM(refund_amount),0) AS total_refunded
		FROM payment_refunds
		WHERE business_id = ? AND refunded_at >= ? AND refunded_at < ? AND refund_status = 'completed' AND deleted_at IS NULL`
	refundArgs := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		refund += " AND branch_id = ?"
		refundArgs = append(refundArgs, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		refund += " AND payment_method_id = ?"
		refundArgs = append(refundArgs, filter.PaymentMethodID)
	}
	refund += " GROUP BY payment_method_id"
	args = append(args, refundArgs...)
	return `
		SELECT collected.payment_method_id::text AS payment_method_id,
			collected.payment_method_name,
			collected.payment_method_type,
			collected.total_collected,
			COALESCE(refunds.total_refunded,0) AS total_refunded,
			(collected.total_collected - COALESCE(refunds.total_refunded,0)) AS net_collected,
			collected.transaction_count
		FROM (
			SELECT payment_method_id,
				payment_method_name,
				payment_method_type,
				COALESCE(SUM(amount),0) AS total_collected,
				COUNT(*) AS transaction_count
			FROM (` + union + `) method_payments
			WHERE status IN ('completed','partially_refunded','refunded')
			GROUP BY payment_method_id, payment_method_name, payment_method_type
		) collected
		LEFT JOIN (` + refund + `) refunds ON refunds.payment_method_id = collected.payment_method_id
		ORDER BY collected.total_collected DESC`, args
}

func financialOutstandingSummarySQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	rows, args := financialOutstandingRowsSQL(filter)
	return "SELECT COALESCE(SUM(balance_amount),0) FROM (" + rows + ") outstanding", args
}

func financialOutstandingRowsSQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	pos := `
		SELECT 'pos_sale' AS source_type,
			s.sale_number AS source_number,
			COALESCE(c.full_name,'Walk-in Customer') AS customer_name,
			b.branch_name,
			s.total_amount,
			s.paid_amount,
			(s.total_amount - s.paid_amount) AS balance_amount,
			s.sold_at::date::text AS due_date,
			s.payment_status
		FROM sales s
		JOIN branches b ON b.id = s.branch_id
		LEFT JOIN customers c ON c.id = s.customer_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.payment_status IN ('unpaid','partial') AND s.sale_status <> 'voided' AND s.deleted_at IS NULL AND (s.total_amount - s.paid_amount) > 0`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		pos += " AND s.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	bakery := `
		SELECT 'bakery_order' AS source_type,
			bo.order_number AS source_number,
			COALESCE(bo.customer_name_snapshot,'Walk-in Customer') AS customer_name,
			b.branch_name,
			bo.total_amount,
			bo.paid_amount,
			bo.balance_amount,
			bo.event_date::text AS due_date,
			bo.payment_status
		FROM bakery_orders bo
		JOIN branches b ON b.id = bo.branch_id
		WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.payment_status IN ('unpaid','partial') AND bo.order_status <> 'cancelled' AND bo.deleted_at IS NULL AND bo.balance_amount > 0`
	args = append(args, filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02"))
	if !filter.AllBranches {
		bakery += " AND bo.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	return pos + " UNION ALL " + bakery, args
}

func financialTrendSQL(filter *shared.ResolvedFilter) (string, []interface{}) {
	pos := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(sp.amount),0) AS collected,
			0::numeric AS refunded
		FROM sale_payments sp
		WHERE sp.business_id = ? AND sp.paid_at >= ? AND sp.paid_at < ? AND sp.payment_status IN ('completed','partially_refunded','refunded') AND sp.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "sp.paid_at"))
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	if !filter.AllBranches {
		pos += " AND sp.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		pos += " AND sp.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	pos += " GROUP BY bucket"
	bakery := fmt.Sprintf(`
		SELECT %s AS bucket,
			COALESCE(SUM(bop.amount),0) AS collected,
			0::numeric AS refunded
		FROM bakery_order_payments bop
		JOIN bakery_orders bo ON bo.id = bop.bakery_order_id
		WHERE bop.business_id = ? AND bop.paid_at >= ? AND bop.paid_at < ? AND bo.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "bop.paid_at"))
	args = append(args, filter.BusinessID, filter.StartUTC, filter.EndUTC)
	if !filter.AllBranches {
		bakery += " AND bo.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		bakery += " AND bop.payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	bakery += " GROUP BY bucket"
	refunds := fmt.Sprintf(`
		SELECT %s AS bucket,
			0::numeric AS collected,
			COALESCE(SUM(refund_amount),0) AS refunded
		FROM payment_refunds
		WHERE business_id = ? AND refunded_at >= ? AND refunded_at < ? AND refund_status = 'completed' AND deleted_at IS NULL`, dateTrunc(filter.GroupBy, "refunded_at"))
	args = append(args, filter.BusinessID, filter.StartUTC, filter.EndUTC)
	if !filter.AllBranches {
		refunds += " AND branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.PaymentMethodID != "" {
		refunds += " AND payment_method_id = ?"
		args = append(args, filter.PaymentMethodID)
	}
	refunds += " GROUP BY bucket"
	query := `
		SELECT bucket,
			COALESCE(SUM(collected),0) AS net_sales,
			COALESCE(SUM(refunded),0) AS sales_count
		FROM (` + pos + " UNION ALL " + bakery + " UNION ALL " + refunds + `) financial_trend
		GROUP BY bucket ORDER BY bucket ASC`
	return query, args
}

func (r *Repository) countInventoryItems(filter *shared.ResolvedFilter) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM inventory_items ii WHERE ii.business_id = ? AND ii.deleted_at IS NULL"
	args := []interface{}{filter.BusinessID}
	query, args = addInventoryItemFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) countMovements(filter *shared.ResolvedFilter) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM stock_movements sm WHERE sm.business_id = ? AND sm.created_at >= ? AND sm.created_at < ?"
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addMovementFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) countProductionBatches(filter *shared.ResolvedFilter) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM production_batches pb WHERE pb.business_id = ? AND pb.production_date >= ? AND pb.production_date <= ? AND pb.deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, filter.DateFrom.Format("2006-01-02"), filter.DateTo.Format("2006-01-02")}
	query, args = addManufacturingFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) countBakeryOrdersBetween(filter *shared.ResolvedFilter, dateFrom, dateTo string) (int64, error) {
	var total int64
	query := "SELECT COUNT(*) FROM bakery_orders bo WHERE bo.business_id = ? AND bo.event_date >= ? AND bo.event_date <= ? AND bo.deleted_at IS NULL"
	args := []interface{}{filter.BusinessID, dateFrom, dateTo}
	query, args = addBakeryOrderFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func addSalesFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	query, args = addHeaderSalesFilters(query, args, filter)
	if filter.ProductID != "" {
		query += " AND si.product_id = ?"
		args = append(args, filter.ProductID)
	}
	if filter.CategoryID != "" {
		query += " AND p.category_id = ?"
		args = append(args, filter.CategoryID)
	}
	return query, args
}

func addHeaderSalesFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND s.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.CashierUserID != "" {
		query += " AND s.cashier_user_id = ?"
		args = append(args, filter.CashierUserID)
	}
	if filter.PaymentStatus != "" {
		query += " AND s.payment_status = ?"
		args = append(args, filter.PaymentStatus)
	}
	if filter.SaleStatus != "" {
		query += " AND s.sale_status = ?"
		args = append(args, filter.SaleStatus)
	}
	return query, args
}

func (r *Repository) salesReturnTotalForRange(filter *shared.ResolvedFilter, startUTC, endUTC time.Time) (float64, error) {
	var total float64
	query := `
		SELECT COALESCE(SUM(sri.line_total),0)
		FROM sales_return_items sri
		JOIN sales_returns sr ON sr.id = sri.sales_return_id
		JOIN sales s ON s.id = sr.sale_id
		LEFT JOIN products p ON p.id = sri.product_id
		WHERE sr.business_id = ? AND sr.return_date >= ? AND sr.return_date < ? AND sr.status = 'posted' AND sr.deleted_at IS NULL AND sri.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, startUTC, endUTC}
	query, args = addSalesReturnFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) salesReturnTotalsByBucket(filter *shared.ResolvedFilter) ([]timeSeriesRow, error) {
	rows := []timeSeriesRow{}
	query := fmt.Sprintf(`
		SELECT %s AS bucket, COALESCE(SUM(sri.line_total),0) AS value
		FROM sales_return_items sri
		JOIN sales_returns sr ON sr.id = sri.sales_return_id
		JOIN sales s ON s.id = sr.sale_id
		LEFT JOIN products p ON p.id = sri.product_id
		WHERE sr.business_id = ? AND sr.return_date >= ? AND sr.return_date < ? AND sr.status = 'posted' AND sr.deleted_at IS NULL AND sri.deleted_at IS NULL`, dateTrunc(filter.GroupBy, "sr.return_date"))
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesReturnFilters(query, args, filter)
	query += " GROUP BY bucket ORDER BY bucket ASC"
	err := r.db.Raw(query, args...).Scan(&rows).Error
	return rows, err
}

func addSalesReturnFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	if !filter.AllBranches {
		query += " AND sr.branch_id = ?"
		args = append(args, filter.BranchID)
	}
	if filter.CashierUserID != "" {
		query += " AND s.cashier_user_id = ?"
		args = append(args, filter.CashierUserID)
	}
	if filter.PaymentStatus != "" {
		query += " AND s.payment_status = ?"
		args = append(args, filter.PaymentStatus)
	}
	if filter.SaleStatus != "" {
		query += " AND s.sale_status = ?"
		args = append(args, filter.SaleStatus)
	}
	if filter.ProductID != "" {
		query += " AND sri.product_id = ?"
		args = append(args, filter.ProductID)
	}
	if filter.CategoryID != "" {
		query += " AND p.category_id = ?"
		args = append(args, filter.CategoryID)
	}
	return query, args
}

func addReceiptRecordFilters(query string, args []interface{}, filter *shared.ResolvedFilter) (string, []interface{}) {
	query, args = addHeaderSalesFilters(query, args, filter)
	if filter.Search != "" {
		like := "%" + strings.ToLower(filter.Search) + "%"
		query += " AND (LOWER(s.sale_number) LIKE ? OR LOWER(COALESCE(c.full_name, '')) LIKE ? OR LOWER(COALESCE(u.full_name, '')) LIKE ?)"
		args = append(args, like, like, like)
	}
	return query, args
}

func (r *Repository) countReceiptRecords(filter *shared.ResolvedFilter) (int64, error) {
	var total int64
	query := `
		SELECT COUNT(*)
		FROM sales s
		LEFT JOIN customers c ON c.id = s.customer_id
		LEFT JOIN users u ON u.id = s.cashier_user_id
		WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.deleted_at IS NULL`
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addReceiptRecordFilters(query, args, filter)
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func (r *Repository) countGroupedSales(filter *shared.ResolvedFilter, groupExpr string) (int64, error) {
	var total int64
	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
			SELECT %s
			FROM sale_items si
			JOIN sales s ON s.id = si.sale_id
			LEFT JOIN products p ON p.id = si.product_id
			WHERE s.business_id = ? AND s.sold_at >= ? AND s.sold_at < ? AND s.sale_status <> 'voided' AND s.deleted_at IS NULL`, groupExpr)
	args := []interface{}{filter.BusinessID, filter.StartUTC, filter.EndUTC}
	query, args = addSalesFilters(query, args, filter)
	query += " GROUP BY " + groupExpr + ") report_count"
	err := r.db.Raw(query, args...).Scan(&total).Error
	return total, err
}

func safeSort(requested string, allowed map[string]string, fallback string) string {
	requested = strings.TrimSpace(requested)
	if value, ok := allowed[requested]; ok {
		return value
	}
	return allowed[fallback]
}

func percentageChange(current, previous float64) float64 {
	if previous == 0 {
		if current == 0 {
			return 0
		}
		return 100
	}
	return ((current - previous) / previous) * 100
}

func dateTrunc(groupBy, column string) string {
	switch groupBy {
	case "week":
		return "DATE_TRUNC('week', " + column + ")"
	case "month":
		return "DATE_TRUNC('month', " + column + ")"
	default:
		return "DATE_TRUNC('day', " + column + ")"
	}
}

func toChartPoints(rows []timeSeriesRow, groupBy string) []shared.ChartPoint {
	points := make([]shared.ChartPoint, 0, len(rows))
	for _, row := range rows {
		points = append(points, shared.ChartPoint{Label: formatBucket(row.Bucket, groupBy), Value: row.Value})
	}
	return points
}

func formatBucket(value time.Time, groupBy string) string {
	if groupBy == "month" {
		return value.Format("2006-01")
	}
	return value.Format("2006-01-02")
}

func fmtFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}
