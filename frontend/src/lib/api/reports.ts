import { getBranches as getBranchList } from "@/lib/api/branches";
import { apiBlobRequest, apiRequest } from "@/lib/api/client";
import type { Branch } from "@/types/branch";
import type {
  ExportReportDownload,
  ReceiptRecordRow,
  ReceiptRecordsFilters,
  ReportBaseFilters,
  ReportChartData,
  ReportExportOption,
  ReportExportPayload,
  ReportFilters,
  ReportsDashboardSummary,
  ReportType,
} from "@/types/reports";

type BackendReportsSummary = {
  sales?: {
    total_sales?: number;
    sales_count?: number;
    average_order_value?: number;
  };
  inventory?: {
    low_stock_count?: number;
    expiring_items_count?: number;
  };
  manufacturing?: {
    active_batches?: number;
    completed_batches?: number;
  };
  orders?: {
    pending_orders?: number;
    ready_orders?: number;
  };
  payments?: {
    collected_amount?: number;
    refund_amount?: number;
  };
};

type BackendReportChartDataset = {
  label?: string;
  data?: unknown;
};

type BackendReportChartData = {
  labels?: unknown;
  datasets?: unknown;
};

type BackendReportExportPayload = {
  report_type: ReportType;
  filters: Record<string, string | number>;
};

type BackendReportExportOption = {
  category?: string;
  description?: string;
  label?: string;
  report_type?: string;
  supported?: boolean;
  unsupported_reason?: string;
};

type BackendReceiptRecordRow = {
  branch_name?: string;
  cashier_name?: string;
  customer_name?: string;
  last_viewed_at?: string;
  paid_amount?: number;
  payment_status?: string;
  receipt_status?: string;
  sale_id?: string;
  sale_number?: string;
  sale_status?: string;
  sold_at?: string;
  total_amount?: number;
  view_count?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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
  if (Array.isArray(value.receipts)) {
    return value.receipts;
  }
  return [];
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === "number");
}

function parseReportsSummary(value: unknown): ReportsDashboardSummary {
  if (!isObject(value)) {
    throw new Error("Backend reports summary payload is invalid.");
  }

  const summary = value as BackendReportsSummary;

  return {
    sales: {
      totalSales: numberOrZero(summary.sales?.total_sales),
      salesCount: numberOrZero(summary.sales?.sales_count),
      averageOrderValue: numberOrZero(summary.sales?.average_order_value),
    },
    inventory: {
      lowStockCount: numberOrZero(summary.inventory?.low_stock_count),
      expiringItemsCount: numberOrZero(summary.inventory?.expiring_items_count),
    },
    manufacturing: {
      activeBatches: numberOrZero(summary.manufacturing?.active_batches),
      completedBatches: numberOrZero(summary.manufacturing?.completed_batches),
    },
    orders: {
      pendingOrders: numberOrZero(summary.orders?.pending_orders),
      readyOrders: numberOrZero(summary.orders?.ready_orders),
    },
    payments: {
      collectedAmount: numberOrZero(summary.payments?.collected_amount),
      refundAmount: numberOrZero(summary.payments?.refund_amount),
    },
  };
}

function parseReportChartData(value: unknown): ReportChartData {
  if (!isObject(value)) {
    throw new Error("Backend report chart payload is invalid.");
  }

  const chart = value as BackendReportChartData;
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset): ReportChartData["datasets"][number] => {
        const typedDataset = dataset as BackendReportChartDataset;

        return {
          label: typeof typedDataset.label === "string" ? typedDataset.label : "Dataset",
          data: numberList(typedDataset.data),
        };
      })
    : [];

  return {
    labels: stringList(chart.labels),
    datasets,
  };
}

function appendFilter(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value !== undefined && value !== "") {
    params.set(key, String(value));
  }
}

function toSearchParams(filters: ReportFilters): string {
  const params = new URLSearchParams();

  appendFilter(params, "branch_id", filters.branchId);
  appendFilter(params, "scope", filters.scope);
  appendFilter(params, "date_from", filters.dateFrom);
  appendFilter(params, "date_to", filters.dateTo);
  appendFilter(params, "timezone", filters.timezone);
  appendFilter(params, "group_by", filters.groupBy);
  appendFilter(params, "page", filters.page);
  appendFilter(params, "limit", filters.limit);
  appendFilter(params, "sort_by", filters.sortBy);
  appendFilter(params, "sort_order", filters.sortOrder);

  const query = params.toString();

  return query ? `?${query}` : "";
}

function toReceiptSearchParams(filters: ReceiptRecordsFilters): string {
  const params = new URLSearchParams();

  appendFilter(params, "branch_id", filters.branchId);
  appendFilter(params, "scope", filters.scope);
  appendFilter(params, "date_from", filters.dateFrom);
  appendFilter(params, "date_to", filters.dateTo);
  appendFilter(params, "timezone", filters.timezone);
  appendFilter(params, "page", filters.page);
  appendFilter(params, "limit", filters.limit);
  appendFilter(params, "sort_by", filters.sortBy);
  appendFilter(params, "sort_order", filters.sortOrder);
  appendFilter(params, "search", filters.search);
  appendFilter(params, "cashier_user_id", filters.cashierUserId);
  appendFilter(params, "payment_status", filters.paymentStatus);
  appendFilter(params, "sale_status", filters.saleStatus);

  const query = params.toString();

  return query ? `?${query}` : "";
}

function parseReceiptRecord(value: unknown): ReceiptRecordRow {
  const row = isObject(value) ? (value as BackendReceiptRecordRow) : {};

  return {
    branchName: stringOrEmpty(row.branch_name),
    cashierName: stringOrEmpty(row.cashier_name),
    customerName: stringOrEmpty(row.customer_name),
    lastViewedAt: stringOrEmpty(row.last_viewed_at),
    paidAmount: numberOrZero(row.paid_amount),
    paymentStatus: stringOrEmpty(row.payment_status),
    receiptStatus: stringOrEmpty(row.receipt_status),
    saleId: stringOrEmpty(row.sale_id),
    saleNumber: stringOrEmpty(row.sale_number),
    saleStatus: stringOrEmpty(row.sale_status),
    soldAt: stringOrEmpty(row.sold_at),
    totalAmount: numberOrZero(row.total_amount),
    viewCount: numberOrZero(row.view_count),
  };
}

function parseReceiptRecords(value: unknown): ReceiptRecordRow[] {
  return listSource(value).map(parseReceiptRecord);
}

function parseReportExportOption(value: unknown): ReportExportOption {
  const option = isObject(value) ? (value as BackendReportExportOption) : {};

  return {
    category: stringOrEmpty(option.category),
    description: stringOrEmpty(option.description),
    label: stringOrEmpty(option.label),
    reportType: stringOrEmpty(option.report_type),
    supported: option.supported === true,
    unsupportedReason: stringOrEmpty(option.unsupported_reason),
  };
}

function parseReportExportOptions(value: unknown): ReportExportOption[] {
  return listSource(value)
    .map(parseReportExportOption)
    .filter((option) => option.reportType && option.label);
}

function toBackendFilters(filters: ReportBaseFilters): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (filters.branchId) {
    result.branch_id = filters.branchId;
  }
  if (filters.scope) {
    result.scope = filters.scope;
  }
  if (filters.dateFrom) {
    result.date_from = filters.dateFrom;
  }
  if (filters.dateTo) {
    result.date_to = filters.dateTo;
  }
  if (filters.timezone) {
    result.timezone = filters.timezone;
  }
  if (filters.groupBy) {
    result.group_by = filters.groupBy;
  }

  return result;
}

function isCsvContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();

  return normalized.includes("text/csv") || normalized.includes("application/csv");
}

function fallbackExportFilename(payload: ReportExportPayload): string {
  return `${payload.reportType}-${payload.filters.dateFrom}-to-${payload.filters.dateTo}.csv`;
}

export async function getReportsDashboardSummary(
  filters: ReportFilters,
): Promise<ReportsDashboardSummary> {
  const response = await apiRequest<ReportsDashboardSummary>(
    `/api/v1/reports/dashboard/summary${toSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseReportsSummary,
    },
  );

  return response.data;
}

export async function getSalesChart(filters: ReportFilters): Promise<ReportChartData> {
  const response = await apiRequest<ReportChartData>(
    `/api/v1/reports/chart/sales${toSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseReportChartData,
    },
  );

  return response.data;
}

export async function getPaymentsChart(filters: ReportFilters): Promise<ReportChartData> {
  const response = await apiRequest<ReportChartData>(
    `/api/v1/reports/chart/payments${toSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseReportChartData,
    },
  );

  return response.data;
}

export async function getOrdersChart(filters: ReportFilters): Promise<ReportChartData> {
  const response = await apiRequest<ReportChartData>(
    `/api/v1/reports/chart/orders${toSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseReportChartData,
    },
  );

  return response.data;
}

export async function getReceiptRecords(
  filters: ReceiptRecordsFilters,
): Promise<ReceiptRecordRow[]> {
  const response = await apiRequest<ReceiptRecordRow[]>(
    `/api/v1/reports/receipts${toReceiptSearchParams(filters)}`,
    {
      authMode: "appwrite",
      parse: parseReceiptRecords,
    },
  );

  return response.data;
}

export async function exportReportCsv(payload: ReportExportPayload): Promise<ExportReportDownload> {
  const response = await apiBlobRequest<BackendReportExportPayload>("/api/v1/reports/export/csv", {
    method: "POST",
    authMode: "appwrite",
    body: {
      report_type: payload.reportType,
      filters: toBackendFilters(payload.filters),
    },
  });

  if (response.blob.size === 0) {
    throw new Error("The export completed but the backend returned an empty CSV file.");
  }

  if (!isCsvContentType(response.contentType)) {
    throw new Error(
      `The export completed but the backend returned ${response.contentType || "an unknown content type"} instead of CSV.`,
    );
  }

  return {
    ...response,
    filename: response.filename ?? fallbackExportFilename(payload),
  };
}

export async function getReportExportOptions(): Promise<ReportExportOption[]> {
  const response = await apiRequest<ReportExportOption[]>("/api/v1/reports/export/options", {
    authMode: "appwrite",
    parse: parseReportExportOptions,
  });

  return response.data;
}

export async function getReportBranches(): Promise<Branch[]> {
  return getBranchList();
}
