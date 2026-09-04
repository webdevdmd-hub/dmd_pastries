export type DashboardSeverity = "critical" | "info" | "warning";

export type DashboardAlert = {
  alertType: string;
  createdAt: string;
  description: string;
  referenceId: string;
  severity: DashboardSeverity;
  title: string;
};

export type DashboardActivity = {
  activityType: string;
  createdAt: string;
  createdBy: string;
  description: string;
  entityType: string;
  moduleLabel: string;
  recordLabel: string;
  referenceNumber: string;
  title: string;
};

export type KpiSummary = {
  averageOrderValue: number;
  activeBatches: number;
  completedBatches: number;
  expiringItems: number;
  lowStockCount: number;
  pendingOrders: number;
  readyOrders: number;
  refundsToday: number;
  salesCountToday: number;
  todayCollected: number;
  todayOrders: number;
  todaySales: number;
};

export type DashboardLoadWarning = {
  message: string;
  reason: string;
  segment: string;
};

export type AdminDashboard = {
  customers: {
    newCustomersToday: number;
  };
  financial: {
    collectedToday: number;
    outstandingBalance: number;
    refundsToday: number;
  };
  inventory: {
    expiringItems: number;
    lowStockCount: number;
    outOfStock: number;
  };
  manufacturing: {
    activeBatches: number;
    completedToday: number;
  };
  orders: {
    inProduction: number;
    pendingOrders: number;
    readyOrders: number;
  };
  sales: {
    averageOrderValue: number;
    monthlySales: number;
    salesCountToday: number;
    todaySales: number;
  };
  /**
   * The same figures over the window of equal length immediately before this
   * one. Absent when the backend could not compute the comparison, in which
   * case no delta is shown at all.
   *
   * Outstanding balance has no entry here on purpose: it is a point-in-time
   * ledger balance, not a figure accumulated over a window.
   */
  previous: AdminDashboardPrevious | null;
  loadWarnings: DashboardLoadWarning[];
};

export type AdminDashboardPrevious = {
  averageOrderValue: number;
  collected: number;
  dateFrom: string;
  dateTo: string;
  sales: number;
  salesCount: number;
};

export type CashierDashboard = {
  orders: {
    deliveryReady: number;
    pickupReady: number;
  };
  payments: {
    cardCollected: number;
    cashCollected: number;
  };
  sales: {
    refundCount: number;
    salesCount: number;
    todaySales: number;
  };
  shiftSummary: {
    openShift: boolean;
    shiftCollected: number;
  };
};

export type ProductionDashboard = {
  batches: {
    activeBatches: number;
    completedToday: number;
    pendingBatches: number;
  };
  ingredients: {
    expiringIngredients: number;
    lowStockIngredients: number;
  };
  orders: {
    ordersDueToday: number;
    ordersWaitingProduction: number;
  };
  wastage: {
    wastageToday: number;
  };
};

export type PurchasingDashboard = {
  inventory: {
    criticalLowStock: number;
    lowStockItems: number;
  };
  purchasing: {
    openPurchaseOrders: number;
    pendingReceipts: number;
    supplierPayables: number;
  };
  suppliers: {
    activeSuppliers: number;
  };
};
