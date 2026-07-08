import { apiRequest } from "@/lib/api/client";
import type {
  AdminDashboard,
  CashierDashboard,
  DashboardActivity,
  DashboardAlert,
  DashboardSeverity,
  KpiSummary,
  ProductionDashboard,
  PurchasingDashboard,
} from "@/types/dashboard";
import type { ReportGroupBy } from "@/types/reports";

export type DashboardRequestFilters = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: ReportGroupBy;
  scope?: "all_branches" | "current_branch";
  timezone?: string;
};

type BackendAlert = {
  alert_type?: string;
  created_at?: string;
  description?: string;
  reference_id?: string;
  severity?: string;
  title?: string;
};

type BackendActivity = {
  activity_type?: string;
  created_at?: string;
  created_by?: string;
  description?: string;
  entity_type?: string;
  module_label?: string;
  record_label?: string;
  reference_number?: string;
  title?: string;
};

type BackendDashboardAlerts = {
  expiry_alerts?: unknown[];
  low_stock_alerts?: unknown[];
  outstanding_payment_alerts?: unknown[];
  pending_order_alerts?: unknown[];
  production_delay_alerts?: unknown[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function objectValue(value: unknown, key: string): Record<string, unknown> {
  if (!isObject(value)) return {};
  const nested = value[key];
  return isObject(nested) ? nested : {};
}

function numberField(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  return typeof field === "number" ? field : 0;
}

function numberFieldAny(value: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const field = value[key];
    if (typeof field === "number") return field;
  }
  return 0;
}

function booleanField(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  return typeof field === "boolean" ? field : false;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === "string" ? field : "";
}

function isUuidLike(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    ) || /^[0-9a-f]{32}$/i.test(trimmed)
  );
}

function businessReferenceField(value: Record<string, unknown>, key: string): string {
  const reference = stringField(value, key).trim();
  return reference && !isUuidLike(reference) ? reference : "";
}

function listSource(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.rows)) return value.rows;
  return [];
}

function toSearchParams(filters?: DashboardRequestFilters): string {
  const params = new URLSearchParams();
  if (filters?.branchId) {
    params.set("branch_id", filters.branchId);
  }
  if (filters?.dateFrom) {
    params.set("date_from", filters.dateFrom);
  }
  if (filters?.dateTo) {
    params.set("date_to", filters.dateTo);
  }
  if (filters?.groupBy) {
    params.set("group_by", filters.groupBy);
  }
  if (filters?.scope) {
    params.set("scope", filters.scope);
  }
  if (filters?.timezone) {
    params.set("timezone", filters.timezone);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function parseSeverity(value: string): DashboardSeverity {
  if (value === "critical" || value === "warning" || value === "info") return value;
  return "info";
}

function parseAdminDashboard(value: unknown): AdminDashboard {
  const sales = objectValue(value, "sales");
  const inventory = objectValue(value, "inventory");
  const orders = objectValue(value, "orders");
  const manufacturing = objectValue(value, "manufacturing");
  const financial = objectValue(value, "financial");
  const customers = objectValue(value, "customers");
  return {
    customers: {
      newCustomersToday: numberField(customers, "new_customers_today"),
    },
    financial: {
      collectedToday: numberField(financial, "collected_today"),
      outstandingBalance: numberField(financial, "outstanding_balance"),
      refundsToday: numberField(financial, "refund_total_today"),
    },
    inventory: {
      expiringItems: numberField(inventory, "expiring_items_count"),
      lowStockCount: numberField(inventory, "low_stock_count"),
      outOfStock: numberField(inventory, "out_of_stock"),
    },
    manufacturing: {
      activeBatches: numberField(manufacturing, "active_batches"),
      completedToday: numberFieldAny(manufacturing, [
        "completed_batches_today",
        "completed_today",
      ]),
    },
    orders: {
      inProduction: numberField(orders, "in_production"),
      pendingOrders: numberField(orders, "pending_orders"),
      readyOrders: numberField(orders, "ready_orders"),
    },
    sales: {
      averageOrderValue: numberField(sales, "average_order_value"),
      monthlySales: numberField(sales, "monthly_sales"),
      salesCountToday: numberField(sales, "sales_count_today"),
      todaySales: numberField(sales, "today_sales"),
    },
  };
}

function parseCashierDashboard(value: unknown): CashierDashboard {
  const sales = objectValue(value, "sales");
  const orders = objectValue(value, "orders");
  const payments = objectValue(value, "payments");
  const shiftSummary = objectValue(value, "shift_summary");
  return {
    orders: {
      deliveryReady: numberField(orders, "delivery_ready"),
      pickupReady: numberField(orders, "pickup_ready"),
    },
    payments: {
      cardCollected: numberField(payments, "card_collected"),
      cashCollected: numberField(payments, "cash_collected"),
    },
    sales: {
      refundCount: numberField(sales, "refund_count"),
      salesCount: numberField(sales, "sales_count"),
      todaySales: numberField(sales, "today_sales"),
    },
    shiftSummary: {
      openShift: booleanField(shiftSummary, "open_shift"),
      shiftCollected: numberField(shiftSummary, "shift_collected"),
    },
  };
}

function parseProductionDashboard(value: unknown): ProductionDashboard {
  const batches = objectValue(value, "batches");
  const ingredients = objectValue(value, "ingredients");
  const orders = objectValue(value, "orders");
  const wastage = objectValue(value, "wastage");
  return {
    batches: {
      activeBatches: numberField(batches, "active_batches"),
      completedToday: numberField(batches, "completed_today"),
      pendingBatches: numberField(batches, "pending_batches"),
    },
    ingredients: {
      expiringIngredients: numberField(ingredients, "expiring_ingredients"),
      lowStockIngredients: numberField(ingredients, "low_stock_ingredients"),
    },
    orders: {
      ordersDueToday: numberField(orders, "orders_due_today"),
      ordersWaitingProduction: numberField(orders, "orders_waiting_production"),
    },
    wastage: {
      wastageToday: numberFieldAny(wastage, ["today_wastage_quantity", "wastage_today"]),
    },
  };
}

function parsePurchasingDashboard(value: unknown): PurchasingDashboard {
  const purchasing = objectValue(value, "purchasing");
  const inventory = objectValue(value, "inventory");
  const suppliers = objectValue(value, "suppliers");
  return {
    inventory: {
      criticalLowStock: numberField(inventory, "critical_low_stock"),
      lowStockItems: numberField(inventory, "low_stock_items"),
    },
    purchasing: {
      openPurchaseOrders: numberField(purchasing, "open_purchase_orders"),
      pendingReceipts: numberField(purchasing, "pending_receipts"),
      supplierPayables: numberField(purchasing, "supplier_payables"),
    },
    suppliers: {
      activeSuppliers: numberField(suppliers, "active_suppliers"),
    },
  };
}

function parseAlert(value: unknown): DashboardAlert {
  const row = isObject(value) ? (value as BackendAlert) : {};
  return {
    alertType: stringField(row, "alert_type"),
    createdAt: stringField(row, "created_at"),
    description: stringField(row, "description"),
    referenceId: stringField(row, "reference_id"),
    severity: parseSeverity(stringField(row, "severity")),
    title: stringField(row, "title"),
  };
}

function parseDashboardAlerts(value: unknown): DashboardAlert[] {
  if (Array.isArray(value)) return value.map(parseAlert);
  if (!isObject(value)) return [];
  const alerts = value as BackendDashboardAlerts;
  const rows: DashboardAlert[] = [];

  (alerts.low_stock_alerts ?? []).forEach((item) => {
    const row = isObject(item) ? item : {};
    rows.push({
      alertType: "low_stock",
      createdAt: "",
      description: `${stringField(row, "item_name")} is at ${String(numberField(row, "available_quantity"))}, below reorder level ${String(numberField(row, "reorder_level"))}.`,
      referenceId: stringField(row, "item_name"),
      severity: "warning",
      title: "Low stock",
    });
  });

  (alerts.expiry_alerts ?? []).forEach((item) => {
    const row = isObject(item) ? item : {};
    const state = stringField(row, "expiry_state");
    const label = stringField(row, "expiry_state_label") || "Expiring Soon";
    const days = numberField(row, "days_remaining");
    rows.push({
      alertType: "expiry",
      createdAt: "",
      description:
        state === "expired"
          ? `${stringField(row, "item_name")} expired ${String(Math.abs(days))} day(s) ago.`
          : state === "expires_today"
            ? `${stringField(row, "item_name")} expires today.`
            : `${stringField(row, "item_name")} expires in ${String(days)} day(s).`,
      referenceId: stringField(row, "item_name"),
      severity: state === "expired" ? "critical" : "warning",
      title: label,
    });
  });

  (alerts.pending_order_alerts ?? []).forEach((item) => {
    const row = isObject(item) ? item : {};
    rows.push({
      alertType: "pending_order",
      createdAt: "",
      description: `Order ${stringField(row, "order_number")} is ${stringField(row, "order_status")}.`,
      referenceId: stringField(row, "order_number"),
      severity: "info",
      title: "Pending order",
    });
  });

  (alerts.outstanding_payment_alerts ?? []).forEach((item) => {
    const row = isObject(item) ? item : {};
    rows.push({
      alertType: "outstanding_payment",
      createdAt: "",
      description: `Order ${stringField(row, "order_number")} has AED ${String(numberField(row, "balance_amount"))} outstanding.`,
      referenceId: stringField(row, "order_number"),
      severity: "warning",
      title: "Outstanding payment",
    });
  });

  (alerts.production_delay_alerts ?? []).forEach((item) => {
    const row = isObject(item) ? item : {};
    rows.push({
      alertType: "production_delay",
      createdAt: "",
      description: `Batch ${stringField(row, "batch_number")} is still ${stringField(row, "status")}.`,
      referenceId: stringField(row, "batch_number"),
      severity: "warning",
      title: "Production delay",
    });
  });

  return rows;
}

function parseActivity(value: unknown): DashboardActivity {
  const row = isObject(value) ? (value as BackendActivity) : {};
  return {
    activityType: stringField(row, "activity_type"),
    createdAt: stringField(row, "created_at"),
    createdBy: stringField(row, "created_by"),
    description: stringField(row, "description"),
    entityType: stringField(row, "entity_type"),
    moduleLabel: stringField(row, "module_label"),
    recordLabel: stringField(row, "record_label"),
    referenceNumber: businessReferenceField(row, "reference_number"),
    title: stringField(row, "title"),
  };
}

function parseKpiSummary(value: unknown): KpiSummary {
  const row = isObject(value) ? value : {};
  return {
    activeBatches: numberField(row, "active_batches"),
    lowStockCount: numberField(row, "low_stock_count"),
    todayCollected: numberField(row, "today_collected"),
    todayOrders: numberField(row, "today_orders"),
    todaySales: numberField(row, "today_sales"),
  };
}

async function getDashboard<TResponse>(
  path: string,
  parse: (value: unknown) => TResponse,
): Promise<TResponse> {
  const response = await apiRequest<TResponse>(path, {
    authMode: "appwrite",
    parse,
  });
  return response.data;
}

export async function getAdminDashboard(filters?: DashboardRequestFilters): Promise<AdminDashboard> {
  return getDashboard(`/api/v1/dashboard/admin${toSearchParams(filters)}`, parseAdminDashboard);
}

export async function getCashierDashboard(): Promise<CashierDashboard> {
  return getDashboard("/api/v1/dashboard/cashier", parseCashierDashboard);
}

export async function getProductionDashboard(
  filters?: DashboardRequestFilters,
): Promise<ProductionDashboard> {
  return getDashboard(
    `/api/v1/dashboard/production${toSearchParams(filters)}`,
    parseProductionDashboard,
  );
}

export async function getPurchasingDashboard(): Promise<PurchasingDashboard> {
  return getDashboard("/api/v1/dashboard/purchasing", parsePurchasingDashboard);
}

export async function getRecentActivity(): Promise<DashboardActivity[]> {
  return getDashboard("/api/v1/dashboard/recent-activity", (value) =>
    listSource(value).map(parseActivity),
  );
}

export async function getDashboardAlerts(
  filters?: Pick<DashboardRequestFilters, "timezone">,
): Promise<DashboardAlert[]> {
  return getDashboard(`/api/v1/dashboard/alerts${toSearchParams(filters)}`, parseDashboardAlerts);
}

export async function getKpiSummary(): Promise<KpiSummary> {
  return getDashboard("/api/v1/dashboard/kpi-summary", parseKpiSummary);
}
