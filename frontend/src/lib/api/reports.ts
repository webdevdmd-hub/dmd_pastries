import { getBranches as getBranchList } from "@/lib/api/branches";
import { apiBlobRequest, apiRequest } from "@/lib/api/client";
import type { Branch } from "@/types/branch";
import type {
  ReportBaseFilters,
  ReportChartData,
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

export async function exportReportCsv(payload: ReportExportPayload): Promise<Blob> {
  return apiBlobRequest<BackendReportExportPayload>("/api/v1/reports/export/csv", {
    method: "POST",
    authMode: "appwrite",
    body: {
      report_type: payload.reportType,
      filters: toBackendFilters(payload.filters),
    },
  });
}

export async function getReportBranches(): Promise<Branch[]> {
  return getBranchList();
}
