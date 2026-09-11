import type { QueryClient } from "@tanstack/react-query";

import { broadcastChanged } from "@/lib/live-broadcast";

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
  // Staff and workspace roots. These hooks invalidated their keys directly
  // before live updates existed; naming the roots here lets a change on one
  // terminal reach the others.
  users: "users",
  roles: "roles",
  invitations: "invitations",
  onboardingStatus: "onboarding-status",
  businessSettings: "business-settings",
} as const;

export type QueryRoot = (typeof QUERY_ROOTS)[keyof typeof QUERY_ROOTS];

const knownRoots: ReadonlySet<string> = new Set<string>(Object.values(QUERY_ROOTS));

export function isQueryRoot(value: unknown): value is QueryRoot {
  return typeof value === "string" && knownRoots.has(value);
}

/**
 * Invalidate in this tab only. This is what a notice from another tab runs:
 * it must not announce again, or two terminals would ping-pong forever.
 */
export function invalidateRootsLocal(
  queryClient: QueryClient,
  roots: QueryRoot[],
): Promise<void[]> {
  return Promise.all(
    Array.from(new Set(roots)).map((root) =>
      queryClient.invalidateQueries({
        queryKey: [root],
        refetchType: "active",
      }),
    ),
  );
}

/**
 * Invalidate here and tell the business's other tabs to do the same. Every
 * mutation helper in the app goes through this, which is what makes a change
 * on one terminal show on the others without a reload.
 */
export function invalidateRoots(queryClient: QueryClient, roots: QueryRoot[]): Promise<void[]> {
  broadcastChanged(roots);
  return invalidateRootsLocal(queryClient, roots);
}

export function invalidateRoot(queryClient: QueryClient, root: QueryRoot): Promise<void> {
  return invalidateRoots(queryClient, [root]).then(() => undefined);
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
