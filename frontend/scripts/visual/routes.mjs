/**
 * Routes captured by the visual regression harness.
 *
 * Biased toward money, dense tables, and the two density extremes rather than
 * toward coverage for its own sake. Every route here is one a design change
 * could plausibly break in a way nobody would notice by hand.
 *
 * `viewports` defaults to ["ledger"]. The POS is captured at both because it
 * runs on counter hardware at 1024x768 and on a desk at 1440x900.
 */

export const viewports = {
  ledger: { width: 1440, height: 900 },
  counter: { width: 1024, height: 768 },
};

/** Color schemes captured per route. Dark stays inert until migration P11. */
export const schemes = ["light", "dark"];

export const routes = [
  // --- Threshold ---------------------------------------------------------
  { path: "/login", name: "login", auth: false },

  // --- Counter -----------------------------------------------------------
  { path: "/pos", name: "pos", viewports: ["ledger", "counter"] },

  // --- Dashboards --------------------------------------------------------
  { path: "/dashboard", name: "dashboard" },
  { path: "/dashboard/cashier", name: "dashboard-cashier" },
  { path: "/dashboard/admin", name: "dashboard-admin" },
  { path: "/dashboard/production", name: "dashboard-production" },
  { path: "/dashboard/purchasing", name: "dashboard-purchasing" },

  // --- Sales -------------------------------------------------------------
  { path: "/orders", name: "orders" },
  { path: "/customers", name: "customers" },
  { path: "/products", name: "products" },
  { path: "/packaging", name: "packaging" },

  // --- Inventory ---------------------------------------------------------
  { path: "/inventory", name: "inventory" },
  { path: "/inventory/low-stock", name: "inventory-low-stock" },
  { path: "/inventory/movements", name: "inventory-movements" },
  { path: "/inventory/expiry-alerts", name: "inventory-expiry" },
  { path: "/inventory/stock-transfers", name: "inventory-transfers" },

  // --- Manufacturing -----------------------------------------------------
  { path: "/manufacturing", name: "manufacturing" },
  { path: "/manufacturing/batches", name: "manufacturing-batches" },
  { path: "/ingredients", name: "ingredients" },

  // --- Accounting: the densest tables in the app -------------------------
  { path: "/accounting", name: "accounting" },
  { path: "/accounting/chart-of-accounts", name: "acc-chart-of-accounts" },
  { path: "/accounting/journal-entries", name: "acc-journal-entries" },
  { path: "/accounting/reconciliation", name: "acc-reconciliation" },
  { path: "/accounting/opening-balances", name: "acc-opening-balances" },
  { path: "/accounting/reports/trial-balance", name: "acc-trial-balance" },
  { path: "/accounting/reports/balance-sheet", name: "acc-balance-sheet" },
  { path: "/accounting/reports/profit-loss", name: "acc-profit-loss" },
  { path: "/accounting/reports/general-ledger", name: "acc-general-ledger" },

  // --- Payments: every semantic state lives here -------------------------
  { path: "/payments", name: "payments" },
  { path: "/payments/refunds", name: "payments-refunds" },
  { path: "/payments/returns", name: "payments-returns" },
  { path: "/payments/reconciliations", name: "payments-reconciliations" },

  // --- Expenses and audit ------------------------------------------------
  { path: "/expenses", name: "expenses" },
  { path: "/audit-logs", name: "audit-logs" },
];

/**
 * Deliberately excluded: "/" renders the react-three-fiber bakery-door scene,
 * which animates and never settles. It would be red on every run and train
 * everyone to ignore the report. Its 51 hex values are art direction, not
 * design tokens, and no migration phase touches them.
 */
export const excluded = ["/"];
