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
  // /login is NOT captured here. It redirects to the role landing page whenever a
  // session exists, and this harness needs a hand-established authenticated session
  // to reach the other 34 routes — so within one run those two requirements are
  // mutually exclusive. It has to be captured in a separate unauthenticated pass.
  //
  // Leaving it in produced the worst possible outcome: the committed `login`
  // baseline was a screenshot of /dashboard/admin. Plausible in review, distinct
  // from its neighbours, and the wrong page. See TODOS T-Q.

  // --- Counter -----------------------------------------------------------
  { path: "/pos", name: "pos", viewports: ["ledger", "counter"] },

  // --- Dashboards --------------------------------------------------------
  // Redirects by role; for an admin session that is /dashboard/admin. Declared so
  // the redirect assertion passes on a KNOWN destination rather than being
  // silently accepted. Note this makes `dashboard` and `dashboard-admin` the same
  // screenshot for an admin — which is honest, and is what the identical hashes
  // were telling us before the assertion existed.
  { path: "/dashboard", name: "dashboard", redirectsTo: "/dashboard/admin" },
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
  // Five of these are tabs on one page, not routes, so each declares
  // /inventory as its landing pathname -- the strip swaps the panel without
  // changing the path. "By location" was never baselined before; it is now.
  { path: "/inventory", name: "inventory" },
  { path: "/inventory?view=low_stock", name: "inventory-low-stock", redirectsTo: "/inventory" },
  { path: "/inventory?view=expiring", name: "inventory-expiry", redirectsTo: "/inventory" },
  { path: "/inventory?view=locations", name: "inventory-locations", redirectsTo: "/inventory" },
  { path: "/inventory?view=movements", name: "inventory-movements", redirectsTo: "/inventory" },
  { path: "/inventory?view=transfers", name: "inventory-transfers", redirectsTo: "/inventory" },

  // --- Manufacturing -----------------------------------------------------
  { path: "/manufacturing", name: "manufacturing", redirectsTo: "/manufacturing/batches" },
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
