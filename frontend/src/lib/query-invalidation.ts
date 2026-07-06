import type { QueryClient } from "@tanstack/react-query";

export const QUERY_ROOTS = {
  accounting: "accounting",
  bakeryOrderReports: "bakery-orders-reports",
  branches: "branches",
  business: "business",
  customers: "customers",
  dashboard: "dashboard",
  dashboardActivity: "dashboard-activity",
  dashboardAlerts: "dashboard-alerts",
  expenses: "expenses",
  financialReports: "financial-reports",
  ingredients: "ingredients",
  inventory: "inventory",
  inventoryReports: "inventory-reports",
  manufacturing: "manufacturing",
  manufacturingReports: "manufacturing-reports",
  masterData: "master-data",
  orders: "orders",
  packaging: "packaging",
  payments: "payments",
  pos: "pos",
  products: "products",
  purchasing: "purchasing",
  recipes: "recipes",
  refunds: "refunds",
  reports: "reports",
  salesReports: "sales-reports",
  salesReturns: "sales-returns",
  settings: "settings",
  settingsData: "settings-data",
  stockMovements: "stock-movements",
  suppliers: "suppliers",
} as const;

export type QueryRoot = (typeof QUERY_ROOTS)[keyof typeof QUERY_ROOTS];

export function invalidateRoot(queryClient: QueryClient, root: QueryRoot): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: [root],
    refetchType: "active",
  });
}

export function invalidateRoots(queryClient: QueryClient, roots: QueryRoot[]): Promise<void[]> {
  return Promise.all(Array.from(new Set(roots)).map((root) => invalidateRoot(queryClient, root)));
}

export function invalidateProductData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.products,
    QUERY_ROOTS.pos,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.recipes,
    QUERY_ROOTS.manufacturing,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.salesReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.manufacturingReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateMasterDataMutation(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.masterData,
    QUERY_ROOTS.settingsData,
    QUERY_ROOTS.products,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.pos,
    QUERY_ROOTS.recipes,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.salesReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidatePurchasingData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.suppliers,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.products,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateReceiveStockData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.products,
    QUERY_ROOTS.suppliers,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateRecipeData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.recipes,
    QUERY_ROOTS.manufacturing,
    QUERY_ROOTS.products,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.manufacturingReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateManufacturingData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.manufacturing,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.products,
    QUERY_ROOTS.recipes,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.manufacturingReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidatePosTransactionData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.pos,
    QUERY_ROOTS.salesReturns,
    QUERY_ROOTS.refunds,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.customers,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.products,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.salesReports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateOrderData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.orders,
    QUERY_ROOTS.bakeryOrderReports,
    QUERY_ROOTS.products,
    QUERY_ROOTS.pos,
    QUERY_ROOTS.customers,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.manufacturing,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.salesReports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateAccountingSetupData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.settings,
    QUERY_ROOTS.settingsData,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.pos,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateInventoryData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.stockMovements,
    QUERY_ROOTS.products,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateSupplierData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.suppliers,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateCustomerData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.customers,
    QUERY_ROOTS.orders,
    QUERY_ROOTS.pos,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.salesReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateExpenseData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.expenses,
    QUERY_ROOTS.accounting,
    QUERY_ROOTS.payments,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.financialReports,
    QUERY_ROOTS.dashboard,
  ]);
}

export function invalidateComponentCatalogData(queryClient: QueryClient): Promise<void[]> {
  return invalidateRoots(queryClient, [
    QUERY_ROOTS.ingredients,
    QUERY_ROOTS.packaging,
    QUERY_ROOTS.products,
    QUERY_ROOTS.inventory,
    QUERY_ROOTS.recipes,
    QUERY_ROOTS.manufacturing,
    QUERY_ROOTS.purchasing,
    QUERY_ROOTS.reports,
    QUERY_ROOTS.inventoryReports,
    QUERY_ROOTS.manufacturingReports,
    QUERY_ROOTS.dashboard,
  ]);
}
