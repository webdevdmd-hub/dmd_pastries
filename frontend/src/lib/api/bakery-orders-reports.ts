import { apiRequest } from "@/lib/api/client";
import type {
  BakeryOrdersReportFilters,
  BakeryOrdersSummary,
  BakeryOrdersTrendChart,
  DeliveryVsPickupReport,
  OrderStatusRow,
  PendingPaymentRow,
  ProductionScheduleRow,
  UpcomingOrderRow,
} from "@/types/bakery-orders-reports";

type BackendSummary = {
  balance_pending?: number;
  cancelled_orders?: number;
  completed_orders?: number;
  delivery_orders?: number;
  in_production_orders?: number;
  paid_amount?: number;
  pending_orders?: number;
  pickup_orders?: number;
  ready_orders?: number;
  total_order_value?: number;
  total_orders?: number;
};

type BackendUpcomingOrderRow = {
  balance_amount?: number;
  customer_name?: string;
  delivery_time?: string;
  event_date?: string;
  order_id?: string;
  order_number?: string;
  order_status?: string;
  order_type?: string;
  pickup_time?: string;
  total_amount?: number;
};

type BackendOrderStatusRow = {
  order_status?: string;
  orders_count?: number;
  total_order_value?: number;
};

type BackendProductionScheduleRow = {
  assigned_batch_number?: string;
  branch_name?: string;
  event_date?: string;
  has_production_record?: boolean;
  order_number?: string;
  order_status?: string;
  product_name?: string;
  production_batch_status?: string;
  production_note?: string;
  production_status?: string;
  quantity?: number;
};

type BackendPendingPaymentRow = {
  balance_amount?: number;
  customer_name?: string;
  event_date?: string;
  order_number?: string;
  paid_amount?: number;
  payment_status?: string;
  total_amount?: number;
};

type BackendDeliveryVsPickupReport = {
  delivery_orders?: { count?: number; total_value?: number };
  pickup_orders?: { count?: number; total_value?: number };
};

type BackendTrend = { datasets?: unknown; labels?: unknown };
type BackendTrendDataset = { data?: unknown; label?: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function booleanOrFalse(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function listSource(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  return listSource(value).map(parser);
}

function toSearchParams(filters: BakeryOrdersReportFilters): string {
  const params = new URLSearchParams();
  const entries: [string, number | string | undefined][] = [
    ["branch_id", filters.branchId],
    ["customer_id", filters.customerId],
    ["order_status", filters.orderStatus],
    ["payment_status", filters.paymentStatus],
    ["order_type", filters.orderType],
    ["date_from", filters.dateFrom],
    ["date_to", filters.dateTo],
    ["group_by", filters.groupBy],
    ["page", filters.page],
    ["limit", filters.limit],
  ];
  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseSummary(value: unknown): BakeryOrdersSummary {
  const row = isObject(value) ? (value as BackendSummary) : {};
  return {
    balancePending: numberOrZero(row.balance_pending),
    cancelledOrders: numberOrZero(row.cancelled_orders),
    completedOrders: numberOrZero(row.completed_orders),
    deliveryOrders: numberOrZero(row.delivery_orders),
    inProductionOrders: numberOrZero(row.in_production_orders),
    paidAmount: numberOrZero(row.paid_amount),
    pendingOrders: numberOrZero(row.pending_orders),
    pickupOrders: numberOrZero(row.pickup_orders),
    readyOrders: numberOrZero(row.ready_orders),
    totalOrderValue: numberOrZero(row.total_order_value),
    totalOrders: numberOrZero(row.total_orders),
  };
}

function parseUpcomingOrderRow(value: unknown): UpcomingOrderRow {
  const row = isObject(value) ? (value as BackendUpcomingOrderRow) : {};
  return {
    balanceAmount: numberOrZero(row.balance_amount),
    customerName: stringOrEmpty(row.customer_name),
    deliveryTime: stringOrEmpty(row.delivery_time),
    eventDate: stringOrEmpty(row.event_date),
    orderId: stringOrEmpty(row.order_id),
    orderNumber: stringOrEmpty(row.order_number),
    orderStatus: stringOrEmpty(row.order_status),
    orderType: stringOrEmpty(row.order_type),
    pickupTime: stringOrEmpty(row.pickup_time),
    totalAmount: numberOrZero(row.total_amount),
  };
}

function parseOrderStatusRow(value: unknown): OrderStatusRow {
  const row = isObject(value) ? (value as BackendOrderStatusRow) : {};
  return {
    orderStatus: stringOrEmpty(row.order_status),
    ordersCount: numberOrZero(row.orders_count),
    totalOrderValue: numberOrZero(row.total_order_value),
  };
}

function parseProductionScheduleRow(value: unknown): ProductionScheduleRow {
  const row = isObject(value) ? (value as BackendProductionScheduleRow) : {};
  return {
    assignedBatchNumber: stringOrEmpty(row.assigned_batch_number),
    branchName: stringOrEmpty(row.branch_name),
    eventDate: stringOrEmpty(row.event_date),
    hasProductionRecord: booleanOrFalse(row.has_production_record),
    orderNumber: stringOrEmpty(row.order_number),
    orderStatus: stringOrEmpty(row.order_status),
    productName: stringOrEmpty(row.product_name),
    productionBatchStatus: stringOrEmpty(row.production_batch_status),
    productionNote: stringOrEmpty(row.production_note),
    productionStatus: stringOrEmpty(row.production_status),
    quantity: numberOrZero(row.quantity),
  };
}

function parsePendingPaymentRow(value: unknown): PendingPaymentRow {
  const row = isObject(value) ? (value as BackendPendingPaymentRow) : {};
  return {
    balanceAmount: numberOrZero(row.balance_amount),
    customerName: stringOrEmpty(row.customer_name),
    eventDate: stringOrEmpty(row.event_date),
    orderNumber: stringOrEmpty(row.order_number),
    paidAmount: numberOrZero(row.paid_amount),
    paymentStatus: stringOrEmpty(row.payment_status),
    totalAmount: numberOrZero(row.total_amount),
  };
}

function parseDeliveryVsPickup(value: unknown): DeliveryVsPickupReport {
  const row = isObject(value) ? (value as BackendDeliveryVsPickupReport) : {};
  return {
    deliveryOrders: {
      count: numberOrZero(row.delivery_orders?.count),
      totalValue: numberOrZero(row.delivery_orders?.total_value),
    },
    pickupOrders: {
      count: numberOrZero(row.pickup_orders?.count),
      totalValue: numberOrZero(row.pickup_orders?.total_value),
    },
  };
}

function parseTrend(value: unknown): BakeryOrdersTrendChart {
  const chart = isObject(value) ? (value as BackendTrend) : {};
  const labels = Array.isArray(chart.labels)
    ? chart.labels.filter((label): label is string => typeof label === "string")
    : [];
  const datasets = Array.isArray(chart.datasets)
    ? chart.datasets.filter(isObject).map((dataset) => {
        const typedDataset = dataset as BackendTrendDataset;
        return {
          data: Array.isArray(typedDataset.data)
            ? typedDataset.data.filter((item): item is number => typeof item === "number")
            : [],
          label: stringOrEmpty(typedDataset.label),
        };
      })
    : [];
  return { datasets, labels };
}

async function getReport<TResponse>(
  path: string,
  filters: BakeryOrdersReportFilters,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(`${path}${toSearchParams(filters)}`, {
    authMode: "appwrite",
    parse,
  });
  return response.data;
}

export async function getBakeryOrdersSummary(
  filters: BakeryOrdersReportFilters,
): Promise<BakeryOrdersSummary> {
  return getReport("/api/v1/reports/bakery-orders/summary", filters, parseSummary);
}

export async function getUpcomingOrdersReport(
  filters: BakeryOrdersReportFilters,
): Promise<UpcomingOrderRow[]> {
  return getReport("/api/v1/reports/bakery-orders/upcoming", filters, (value) =>
    parseList(value, parseUpcomingOrderRow),
  );
}

export async function getOrderStatusReport(
  filters: BakeryOrdersReportFilters,
): Promise<OrderStatusRow[]> {
  return getReport("/api/v1/reports/bakery-orders/status", filters, (value) =>
    parseList(value, parseOrderStatusRow),
  );
}

export async function getProductionScheduleReport(
  filters: BakeryOrdersReportFilters,
): Promise<ProductionScheduleRow[]> {
  return getReport("/api/v1/reports/bakery-orders/production-schedule", filters, (value) =>
    parseList(value, parseProductionScheduleRow),
  );
}

export async function getPendingPaymentsReport(
  filters: BakeryOrdersReportFilters,
): Promise<PendingPaymentRow[]> {
  return getReport("/api/v1/reports/bakery-orders/pending-payments", filters, (value) =>
    parseList(value, parsePendingPaymentRow),
  );
}

export async function getDeliveryVsPickupReport(
  filters: BakeryOrdersReportFilters,
): Promise<DeliveryVsPickupReport> {
  return getReport(
    "/api/v1/reports/bakery-orders/delivery-vs-pickup",
    filters,
    parseDeliveryVsPickup,
  );
}

export async function getBakeryOrdersTrend(
  filters: BakeryOrdersReportFilters,
): Promise<BakeryOrdersTrendChart> {
  return getReport("/api/v1/reports/bakery-orders/trend", filters, parseTrend);
}
