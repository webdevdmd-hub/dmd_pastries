package reports

import "pastries-pos/internal/modules/reports/shared"

type reportExportOption struct {
	ReportType        string
	Label             string
	Category          string
	Description       string
	Supported         bool
	UnsupportedReason string
}

func reportExportOptions() []reportExportOption {
	chartReason := "Chart and summary-only exports are not available as CSV yet."
	return []reportExportOption{
		{ReportType: "sales", Label: "Sales Receipts", Category: "Sales", Description: "Completed POS sales receipts.", Supported: true},
		{ReportType: "sales_daily", Label: "Daily Sales", Category: "Sales", Description: "Daily sales totals by date.", Supported: true},
		{ReportType: "sales_by_product", Label: "Sales by Product", Category: "Sales", Description: "Product-level quantity, sales, discount, tax, and net totals.", Supported: true},
		{ReportType: "sales_by_category", Label: "Sales by Category", Category: "Sales", Description: "Category-level sales totals.", Supported: true},
		{ReportType: "sales_by_cashier", Label: "Sales by Cashier", Category: "Sales", Description: "Cashier performance and refund/void counts.", Supported: true},
		{ReportType: "sales_by_branch", Label: "Sales by Branch", Category: "Sales", Description: "Branch-level sales totals.", Supported: true},
		{ReportType: "sales_discounts", Label: "Discount Report", Category: "Sales", Description: "Discounted sales and discount amounts.", Supported: true},
		{ReportType: "sales_taxes", Label: "Tax Report", Category: "Sales", Description: "Taxable amounts and collected tax by tax rate.", Supported: true},
		{ReportType: "payments", Label: "POS Payments", Category: "Payments", Description: "POS payment collections.", Supported: true},
		{ReportType: "orders", Label: "Bakery Orders", Category: "Bakery Orders", Description: "Bakery order totals and payment status.", Supported: true},
		{ReportType: "inventory_current_stock", Label: "Current Stock", Category: "Inventory", Description: "Current inventory quantity and availability.", Supported: true},
		{ReportType: "inventory_stock_valuation", Label: "Stock Valuation", Category: "Inventory", Description: "Inventory value and weighted unit cost.", Supported: true},
		{ReportType: "inventory_low_stock", Label: "Low Stock", Category: "Inventory", Description: "Items below reorder level.", Supported: true},
		{ReportType: "inventory_expiry", Label: "Expiry Report", Category: "Inventory", Description: "Expiry-tracked batches and remaining days.", Supported: true},
		{ReportType: "inventory_movements", Label: "Inventory Movements", Category: "Inventory", Description: "Stock movement history.", Supported: true},
		{ReportType: "inventory_wastage", Label: "Inventory Wastage", Category: "Inventory", Description: "Wastage quantities, value, and reasons.", Supported: true},
		{ReportType: "inventory_packaging_stock", Label: "Packaging Stock", Category: "Inventory", Description: "Packaging item stock and value.", Supported: true},
		{ReportType: "inventory_audit", Label: "Inventory Audit", Category: "Inventory", Description: "Inventory balance comparison against stock movements.", Supported: true},
		{ReportType: "manufacturing_batches", Label: "Production Batches", Category: "Manufacturing", Description: "Production batches and yield variance.", Supported: true},
		{ReportType: "manufacturing_ingredient_consumption", Label: "Ingredient Consumption", Category: "Manufacturing", Description: "Consumed ingredients and estimated cost.", Supported: true},
		{ReportType: "manufacturing_yield_variance", Label: "Yield Variance", Category: "Manufacturing", Description: "Planned versus produced quantities.", Supported: true},
		{ReportType: "manufacturing_wastage", Label: "Manufacturing Wastage", Category: "Manufacturing", Description: "Production wastage lines.", Supported: true},
		{ReportType: "manufacturing_recipe_costs", Label: "Recipe Costs", Category: "Manufacturing", Description: "Recipe cost and yield cost details.", Supported: true},
		{ReportType: "bakery_orders_upcoming", Label: "Upcoming Bakery Orders", Category: "Bakery Orders", Description: "Upcoming orders with balances.", Supported: true},
		{ReportType: "bakery_orders_status", Label: "Bakery Order Status", Category: "Bakery Orders", Description: "Order counts and totals by status.", Supported: true},
		{ReportType: "bakery_orders_production_schedule", Label: "Production Schedule", Category: "Bakery Orders", Description: "Bakery order production schedule.", Supported: true},
		{ReportType: "bakery_orders_pending_payments", Label: "Pending Bakery Payments", Category: "Bakery Orders", Description: "Bakery orders with open balances.", Supported: true},
		{ReportType: "bakery_orders_delivery_vs_pickup", Label: "Delivery vs Pickup", Category: "Bakery Orders", Description: "Pickup and delivery order totals.", Supported: true},
		{ReportType: "financial_payments", Label: "Financial Payments", Category: "Financial", Description: "Unified customer payment collections.", Supported: true},
		{ReportType: "financial_refunds", Label: "Financial Refunds", Category: "Financial", Description: "Refund activity.", Supported: true},
		{ReportType: "financial_supplier_payables", Label: "Supplier Payables", Category: "Financial", Description: "Supplier payable balances.", Supported: true},
		{ReportType: "financial_purchase_totals", Label: "Purchase Totals", Category: "Financial", Description: "Purchase totals by supplier.", Supported: true},
		{ReportType: "financial_reconciliation", Label: "Payment Reconciliation", Category: "Financial", Description: "Payment reconciliation lines.", Supported: true},
		{ReportType: "sales_summary", Label: "Sales Summary", Category: "Sales", Description: "Summary cards and chart data.", Supported: false, UnsupportedReason: chartReason},
		{ReportType: "inventory_summary", Label: "Inventory Summary", Category: "Inventory", Description: "Summary cards and chart data.", Supported: false, UnsupportedReason: chartReason},
		{ReportType: "manufacturing_summary", Label: "Manufacturing Summary", Category: "Manufacturing", Description: "Summary cards and chart data.", Supported: false, UnsupportedReason: chartReason},
		{ReportType: "financial_summary", Label: "Financial Summary", Category: "Financial", Description: "Summary cards and chart data.", Supported: false, UnsupportedReason: chartReason},
		{ReportType: "trend_reports", Label: "Trend Charts", Category: "Charts", Description: "Trend chart datasets.", Supported: false, UnsupportedReason: "Trend chart exports are not available as CSV yet."},
	}
}

func exportOptionByType(reportType string) (reportExportOption, bool) {
	for _, option := range reportExportOptions() {
		if option.ReportType == reportType {
			return option, true
		}
	}
	return reportExportOption{}, false
}

func branchScopeLabel(filter *shared.ResolvedFilter) string {
	if filter == nil {
		return ""
	}
	if filter.AllBranches {
		return "all_branches"
	}
	return "branch:" + filter.BranchID
}
