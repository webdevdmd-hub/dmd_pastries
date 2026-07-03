export type ReportTrend = "up" | "down" | "flat";

export type ReportDatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "custom";

export type ReportGroupBy = "day" | "week" | "month" | "payment_method" | "category";

export type ReportScope = "current_branch" | "all_branches";

export type ReportType = string;

export type ReportExportOption = {
  category: string;
  description: string;
  label: string;
  reportType: ReportType;
  supported: boolean;
  unsupportedReason: string;
};

export type ReportBaseFilters = {
  branchId?: string;
  scope?: ReportScope;
  dateFrom: string;
  dateTo: string;
  timezone?: string;
  groupBy?: ReportGroupBy;
};

export type ReportFilters = ReportBaseFilters & {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ReceiptRecordsFilters = {
  branchId?: string;
  cashierUserId?: string;
  dateFrom: string;
  dateTo: string;
  limit?: number;
  page?: number;
  paymentStatus?: string;
  saleStatus?: string;
  scope?: ReportScope;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  timezone?: string;
};

export type ReceiptRecordRow = {
  branchName: string;
  cashierName: string;
  customerName: string;
  lastViewedAt: string;
  paidAmount: number;
  paymentStatus: string;
  receiptStatus: string;
  saleId: string;
  saleNumber: string;
  saleStatus: string;
  soldAt: string;
  totalAmount: number;
  viewCount: number;
};

export type KpiCard = {
  label: string;
  value: string;
  changePercentage?: number;
  trend?: ReportTrend;
};

export type ReportsDashboardSummary = {
  sales: {
    totalSales: number;
    salesCount: number;
    averageOrderValue: number;
  };
  inventory: {
    lowStockCount: number;
    expiringItemsCount: number;
  };
  manufacturing: {
    activeBatches: number;
    completedBatches: number;
  };
  orders: {
    pendingOrders: number;
    readyOrders: number;
  };
  payments: {
    collectedAmount: number;
    refundAmount: number;
  };
};

export type ReportChartDataset = {
  label: string;
  data: number[];
};

export type ReportChartData = {
  labels: string[];
  datasets: ReportChartDataset[];
};

export type ReportExportPayload = {
  reportType: ReportType;
  filters: ReportBaseFilters;
};

export type ExportReportResponse = {
  fileUrl?: string;
  filename?: string;
  generatedAt?: string;
  metadata?: Record<string, string | number | boolean>;
};
