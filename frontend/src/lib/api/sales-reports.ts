import { apiRequest } from "@/lib/api/client";
import type {
  BranchSalesRow,
  CashierSalesRow,
  CategorySalesRow,
  DailySalesRow,
  DiscountReport,
  DiscountReportItem,
  ProductSalesRow,
  SalesReportFilters,
  SalesSummary,
  SalesTrendChart,
  TaxReportRow,
} from "@/types/sales-reports";

type BackendSalesSummary = {
  gross_sales?: number;
  net_sales?: number;
  sales_count?: number;
  items_sold?: number;
  average_order_value?: number;
  discount_total?: number;
  tax_total?: number;
  refund_total?: number;
  voided_sales_count?: number;
  gross_sales_change_percentage?: number;
  net_sales_change_percentage?: number;
  sales_count_change_percentage?: number;
};

type BackendDailySalesRow = {
  date?: string;
  gross_sales?: number;
  net_sales?: number;
  sales_count?: number;
  items_sold?: number;
  discount_total?: number;
  tax_total?: number;
};

type BackendProductSalesRow = {
  product_id?: string;
  product_name?: string;
  sku?: string;
  quantity_sold?: number;
  gross_sales?: number;
  discount_total?: number;
  tax_total?: number;
  net_sales?: number;
};

type BackendCategorySalesRow = {
  category_id?: string;
  category_name?: string;
  quantity_sold?: number;
  sales_count?: number;
  gross_sales?: number;
  net_sales?: number;
};

type BackendCashierSalesRow = {
  cashier_user_id?: string;
  cashier_name?: string;
  sales_count?: number;
  items_sold?: number;
  gross_sales?: number;
  net_sales?: number;
  refund_count?: number;
  void_count?: number;
};

type BackendBranchSalesRow = {
  branch_id?: string;
  branch_name?: string;
  sales_count?: number;
  items_sold?: number;
  gross_sales?: number;
  net_sales?: number;
  tax_total?: number;
};

type BackendDiscountReportItem = {
  sale_number?: string;
  cashier_name?: string;
  discount_type?: string;
  discount_amount?: number;
  sale_total?: number;
  sold_at?: string;
};

type BackendDiscountReport = {
  total_discount?: number;
  sale_level_discount?: number;
  line_level_discount?: number;
  discounted_sales_count?: number;
  discount_percentage_of_gross_sales?: number;
  items?: unknown;
};

type BackendTaxReportRow = {
  tax_rate_id?: string;
  tax_name?: string;
  tax_percentage?: number;
  taxable_amount?: number;
  tax_collected?: number;
  sales_count?: number;
};

type BackendSalesTrend = {
  labels?: unknown;
  datasets?: unknown;
};

type BackendSalesTrendDataset = {
  label?: string;
  data?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function listSource(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isObject(value)) {
    return [];
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (Array.isArray(value.rows)) {
    return value.rows;
  }

  return [];
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  return listSource(value).map(parser);
}

function toSearchParams(filters: SalesReportFilters): string {
  const params = new URLSearchParams();
  const entries: [string, string | number | undefined][] = [
    ["branch_id", filters.branchId],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
    ["timezone", filters.timezone],
    ["group_by", filters.groupBy],
    ["cashier_user_id", filters.cashierUserId],
    ["product_id", filters.productId],
    ["category_id", filters.categoryId],
    ["payment_status", filters.paymentStatus],
    ["sale_status", filters.saleStatus],
    ["page", filters.page],
    ["limit", filters.limit],
    ["sort_by", filters.sortBy],
    ["sort_order", filters.sortOrder],
  ];

  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
}

function parseSalesSummary(value: unknown): SalesSummary {
  if (!isObject(value)) {
    throw new Error("Backend sales summary payload is invalid.");
  }

  const summary = value as BackendSalesSummary;

  return {
    grossSales: numberOrZero(summary.gross_sales),
    netSales: numberOrZero(summary.net_sales),
    salesCount: numberOrZero(summary.sales_count),
    itemsSold: numberOrZero(summary.items_sold),
    averageOrderValue: numberOrZero(summary.average_order_value),
    discountTotal: numberOrZero(summary.discount_total),
    taxTotal: numberOrZero(summary.tax_total),
    refundTotal: numberOrZero(summary.refund_total),
    voidedSalesCount: numberOrZero(summary.voided_sales_count),
    grossSalesChangePercentage: numberOrZero(summary.gross_sales_change_percentage),
    netSalesChangePercentage: numberOrZero(summary.net_sales_change_percentage),
    salesCountChangePercentage: numberOrZero(summary.sales_count_change_percentage),
  };
}

function parseDailySalesRow(value: unknown): DailySalesRow {
  const row = isObject(value) ? (value as BackendDailySalesRow) : {};

  return {
    date: stringOrEmpty(row.date),
    grossSales: numberOrZero(row.gross_sales),
    netSales: numberOrZero(row.net_sales),
    salesCount: numberOrZero(row.sales_count),
    itemsSold: numberOrZero(row.items_sold),
    discountTotal: numberOrZero(row.discount_total),
    taxTotal: numberOrZero(row.tax_total),
  };
}

function parseProductSalesRow(value: unknown): ProductSalesRow {
  const row = isObject(value) ? (value as BackendProductSalesRow) : {};

  return {
    productId: stringOrEmpty(row.product_id),
    productName: stringOrEmpty(row.product_name),
    sku: stringOrEmpty(row.sku),
    quantitySold: numberOrZero(row.quantity_sold),
    grossSales: numberOrZero(row.gross_sales),
    discountTotal: numberOrZero(row.discount_total),
    taxTotal: numberOrZero(row.tax_total),
    netSales: numberOrZero(row.net_sales),
  };
}

function parseCategorySalesRow(value: unknown): CategorySalesRow {
  const row = isObject(value) ? (value as BackendCategorySalesRow) : {};

  return {
    categoryId: stringOrEmpty(row.category_id),
    categoryName: stringOrEmpty(row.category_name),
    quantitySold: numberOrZero(row.quantity_sold),
    salesCount: numberOrZero(row.sales_count),
    grossSales: numberOrZero(row.gross_sales),
    netSales: numberOrZero(row.net_sales),
  };
}

function parseCashierSalesRow(value: unknown): CashierSalesRow {
  const row = isObject(value) ? (value as BackendCashierSalesRow) : {};

  return {
    cashierUserId: stringOrEmpty(row.cashier_user_id),
    cashierName: stringOrEmpty(row.cashier_name),
    salesCount: numberOrZero(row.sales_count),
    itemsSold: numberOrZero(row.items_sold),
    grossSales: numberOrZero(row.gross_sales),
    netSales: numberOrZero(row.net_sales),
    refundCount: numberOrZero(row.refund_count),
    voidCount: numberOrZero(row.void_count),
  };
}

function parseBranchSalesRow(value: unknown): BranchSalesRow {
  const row = isObject(value) ? (value as BackendBranchSalesRow) : {};

  return {
    branchId: stringOrEmpty(row.branch_id),
    branchName: stringOrEmpty(row.branch_name),
    salesCount: numberOrZero(row.sales_count),
    itemsSold: numberOrZero(row.items_sold),
    grossSales: numberOrZero(row.gross_sales),
    netSales: numberOrZero(row.net_sales),
    taxTotal: numberOrZero(row.tax_total),
  };
}

function parseDiscountReportItem(value: unknown): DiscountReportItem {
  const row = isObject(value) ? (value as BackendDiscountReportItem) : {};

  return {
    saleNumber: stringOrEmpty(row.sale_number),
    cashierName: stringOrEmpty(row.cashier_name),
    discountType: stringOrEmpty(row.discount_type),
    discountAmount: numberOrZero(row.discount_amount),
    saleTotal: numberOrZero(row.sale_total),
    soldAt: stringOrEmpty(row.sold_at),
  };
}

function parseDiscountReport(value: unknown): DiscountReport {
  const report = isObject(value) ? (value as BackendDiscountReport) : {};

  return {
    totalDiscount: numberOrZero(report.total_discount),
    saleLevelDiscount: numberOrZero(report.sale_level_discount),
    lineLevelDiscount: numberOrZero(report.line_level_discount),
    discountedSalesCount: numberOrZero(report.discounted_sales_count),
    discountPercentageOfGrossSales: numberOrZero(report.discount_percentage_of_gross_sales),
    items: parseList(report.items, parseDiscountReportItem),
  };
}

function parseTaxReportRow(value: unknown): TaxReportRow {
  const row = isObject(value) ? (value as BackendTaxReportRow) : {};

  return {
    taxRateId: stringOrEmpty(row.tax_rate_id),
    taxName: stringOrEmpty(row.tax_name),
    taxPercentage: numberOrZero(row.tax_percentage),
    taxableAmount: numberOrZero(row.taxable_amount),
    taxCollected: numberOrZero(row.tax_collected),
    salesCount: numberOrZero(row.sales_count),
  };
}

function parseSalesTrend(value: unknown): SalesTrendChart {
  const chart = isObject(value) ? (value as BackendSalesTrend) : {};
  const labels = Array.isArray(chart.labels)
    ? chart.labels.filter((label): label is string => typeof label === "string")
    : [];
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset) => {
        const typedDataset = dataset as BackendSalesTrendDataset;

        return {
          label: stringOrEmpty(typedDataset.label),
          data: Array.isArray(typedDataset.data)
            ? typedDataset.data.filter((item): item is number => typeof item === "number")
            : [],
        };
      })
    : [];

  return { labels, datasets };
}

async function getReport<TResponse>(
  path: string,
  filters: SalesReportFilters,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(`${path}${toSearchParams(filters)}`, {
    authMode: "appwrite",
    parse,
  });

  return response.data;
}

export async function getSalesSummary(filters: SalesReportFilters): Promise<SalesSummary> {
  return getReport("/api/v1/reports/sales/summary", filters, parseSalesSummary);
}

export async function getDailySales(filters: SalesReportFilters): Promise<DailySalesRow[]> {
  return getReport("/api/v1/reports/sales/daily", filters, (value) =>
    parseList(value, parseDailySalesRow),
  );
}

export async function getSalesByProduct(filters: SalesReportFilters): Promise<ProductSalesRow[]> {
  return getReport("/api/v1/reports/sales/by-product", filters, (value) =>
    parseList(value, parseProductSalesRow),
  );
}

export async function getSalesByCategory(filters: SalesReportFilters): Promise<CategorySalesRow[]> {
  return getReport("/api/v1/reports/sales/by-category", filters, (value) =>
    parseList(value, parseCategorySalesRow),
  );
}

export async function getSalesByCashier(filters: SalesReportFilters): Promise<CashierSalesRow[]> {
  return getReport("/api/v1/reports/sales/by-cashier", filters, (value) =>
    parseList(value, parseCashierSalesRow),
  );
}

export async function getSalesByBranch(filters: SalesReportFilters): Promise<BranchSalesRow[]> {
  return getReport("/api/v1/reports/sales/by-branch", filters, (value) =>
    parseList(value, parseBranchSalesRow),
  );
}

export async function getDiscountReport(filters: SalesReportFilters): Promise<DiscountReport> {
  return getReport("/api/v1/reports/sales/discounts", filters, parseDiscountReport);
}

export async function getTaxReport(filters: SalesReportFilters): Promise<TaxReportRow[]> {
  return getReport("/api/v1/reports/sales/taxes", filters, (value) =>
    parseList(value, parseTaxReportRow),
  );
}

export async function getTopProducts(filters: SalesReportFilters): Promise<ProductSalesRow[]> {
  return getReport("/api/v1/reports/sales/top-products", filters, (value) =>
    parseList(value, parseProductSalesRow),
  );
}

export async function getSlowMovingProducts(
  filters: SalesReportFilters,
): Promise<ProductSalesRow[]> {
  return getReport("/api/v1/reports/sales/slow-moving-products", filters, (value) =>
    parseList(value, parseProductSalesRow),
  );
}

export async function getSalesTrend(filters: SalesReportFilters): Promise<SalesTrendChart> {
  return getReport("/api/v1/reports/sales/trend", filters, parseSalesTrend);
}
