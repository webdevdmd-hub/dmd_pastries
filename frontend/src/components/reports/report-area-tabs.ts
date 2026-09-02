import { ROUTES } from "@/constants/routes";

/**
 * The five report areas and the tabs inside each.
 *
 * Every tab is an existing route. The area index used to be an overview page
 * with a grid of "Open" cards linking to six or nine sibling pages, each of
 * which rebuilt the page header and filter bar; reaching the second report
 * meant a round trip through the overview. The area layout now renders one
 * header and one strip, and the sibling routes are its tabs.
 */
export type ReportAreaKey = "sales" | "financial" | "inventory" | "manufacturing" | "bakeryOrders";

export type ReportAreaTab = {
  href: string;
  label: string;
};

export type ReportArea = {
  key: ReportAreaKey;
  title: string;
  description: string;
  /** The first tab is the area index, rendered on the bare area route. */
  tabs: readonly [ReportAreaTab, ...ReportAreaTab[]];
};

export const REPORT_AREAS: Record<ReportAreaKey, ReportArea> = {
  sales: {
    key: "sales",
    title: "Sales Reports",
    description:
      "Analyze sales performance, trends, products, categories, cashiers, branches, discounts, and taxes.",
    tabs: [
      { href: ROUTES.reportsSales, label: "Overview" },
      { href: ROUTES.reportsSalesProducts, label: "Products" },
      { href: ROUTES.reportsSalesCategories, label: "Categories" },
      { href: ROUTES.reportsSalesCashiers, label: "Cashiers" },
      { href: ROUTES.reportsSalesBranches, label: "Branches" },
      { href: ROUTES.reportsSalesDiscounts, label: "Discounts" },
      { href: ROUTES.reportsSalesTaxes, label: "Taxes" },
    ],
  },
  financial: {
    key: "financial",
    title: "Financial Reports",
    description:
      "Analyze collections, refunds, balances, supplier payables, and financial performance.",
    tabs: [
      { href: ROUTES.reportsFinancial, label: "Overview" },
      { href: ROUTES.reportsFinancialPayments, label: "Payments" },
      { href: ROUTES.reportsFinancialRefunds, label: "Refunds" },
      { href: ROUTES.reportsFinancialOutstandingBalances, label: "Outstanding balances" },
      { href: ROUTES.reportsFinancialSupplierPayables, label: "Supplier payables" },
      { href: ROUTES.reportsFinancialReconciliation, label: "Reconciliation" },
    ],
  },
  inventory: {
    key: "inventory",
    title: "Inventory Reports",
    description:
      "Analyze stock levels, valuation, expiry risks, movements, wastage, packaging, and audit accuracy.",
    tabs: [
      { href: ROUTES.reportsInventory, label: "Overview" },
      { href: ROUTES.reportsInventoryCurrentStock, label: "Current stock" },
      { href: ROUTES.reportsInventoryValuation, label: "Valuation" },
      { href: ROUTES.reportsInventoryLowStock, label: "Low stock" },
      { href: ROUTES.reportsInventoryExpiry, label: "Expiry" },
      { href: ROUTES.reportsInventoryMovements, label: "Movements" },
      { href: ROUTES.reportsInventoryWastage, label: "Wastage" },
      { href: ROUTES.reportsInventoryPackaging, label: "Packaging" },
      { href: ROUTES.reportsInventoryAudit, label: "Audit" },
      { href: ROUTES.reportsInventoryAccountingReconciliation, label: "Accounting" },
    ],
  },
  manufacturing: {
    key: "manufacturing",
    title: "Manufacturing Reports",
    description:
      "Analyze production output, recipe costs, ingredient consumption, yield variance, and wastage.",
    tabs: [
      { href: ROUTES.reportsManufacturing, label: "Overview" },
      { href: ROUTES.reportsManufacturingBatches, label: "Batches" },
      { href: ROUTES.reportsManufacturingIngredientConsumption, label: "Ingredient consumption" },
      { href: ROUTES.reportsManufacturingYieldVariance, label: "Yield variance" },
      { href: ROUTES.reportsManufacturingWastage, label: "Wastage" },
      { href: ROUTES.reportsManufacturingRecipeCosts, label: "Recipe costs" },
    ],
  },
  bakeryOrders: {
    key: "bakeryOrders",
    title: "Bakery Orders Reports",
    description:
      "Analyze custom order scheduling, production readiness, pending balances, and delivery trends.",
    tabs: [
      { href: ROUTES.reportsBakeryOrders, label: "Overview" },
      { href: ROUTES.reportsBakeryOrdersUpcoming, label: "Upcoming" },
      { href: ROUTES.reportsBakeryOrdersStatus, label: "Status" },
      { href: ROUTES.reportsBakeryOrdersProductionSchedule, label: "Production schedule" },
      { href: ROUTES.reportsBakeryOrdersPendingPayments, label: "Pending payments" },
      { href: ROUTES.reportsBakeryOrdersDeliveryVsPickup, label: "Delivery vs pickup" },
    ],
  },
};

/** The tab whose href matches the pathname exactly, else the area's overview. */
export function activeReportAreaTab(area: ReportArea, pathname: string): ReportAreaTab {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return area.tabs.find((tab) => tab.href === trimmed) ?? area.tabs[0];
}
