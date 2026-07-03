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

export type DashboardRequestFilters = {
  branchId?: string;
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
  reference_number?: string;
  title?: string;
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

function booleanField(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  return typeof field === "boolean" ? field : false;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === "string" ? field : "";
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
      completedToday: numberField(manufacturing, "completed_today"),
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
      wastageToday: numberField(wastage, "wastage_today"),
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

function parseActivity(value: unknown): DashboardActivity {
  const row = isObject(value) ? (value as BackendActivity) : {};
  return {
    activityType: stringField(row, "activity_type"),
    createdAt: stringField(row, "created_at"),
    createdBy: stringField(row, "created_by"),
    description: stringField(row, "description"),
    referenceNumber: stringField(row, "reference_number"),
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

export async function getProductionDashboard(): Promise<ProductionDashboard> {
  return getDashboard("/api/v1/dashboard/production", parseProductionDashboard);
}

export async function getPurchasingDashboard(): Promise<PurchasingDashboard> {
  return getDashboard("/api/v1/dashboard/purchasing", parsePurchasingDashboard);
}

export async function getRecentActivity(): Promise<DashboardActivity[]> {
  return getDashboard("/api/v1/dashboard/recent-activity", (value) =>
    listSource(value).map(parseActivity),
  );
}

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
  return getDashboard("/api/v1/dashboard/alerts", (value) => listSource(value).map(parseAlert));
}

export async function getKpiSummary(): Promise<KpiSummary> {
  return getDashboard("/api/v1/dashboard/kpi-summary", parseKpiSummary);
}
