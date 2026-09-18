/**
 * Buttons and links are offered only to roles that can use them.
 *
 * Regression: ISSUE-069. On production on 2026-09-18 a till-only role saw
 * dashboard quick actions for Customers, Orders and Payments, the till's
 * "Create order" (bakery order) button, and the receipt's "View Journal";
 * every one ended on "Access denied".
 *
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
 *
 * Usage: node scripts/check-dead-end-actions.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");
const load = (path) => {
  const out = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const state = { exports: {} };
  new Function("exports", "module", out.outputText)(state.exports, state);
  return state.exports;
};

// 1. The filter: every required permission must be held.
const { quickActionsAllowed } = load("src/lib/dashboard/quick-actions.ts");
const tillOnly = new Set(["dashboard.view", "pos.view", "pos.sell", "pos.checkout"]);
const cashierActions = [
  { label: "Open POS Billing", requires: ["pos.view"] },
  { label: "Create Customer", requires: ["customers.view", "customers.create"] },
  { label: "View Ready Orders", requires: ["orders.view"] },
  { label: "Add Payment", requires: ["payments.view", "payments.add"] },
];
assert.deepEqual(
  quickActionsAllowed(cashierActions, (p) => tillOnly.has(p)).map((a) => a.label),
  ["Open POS Billing"],
  "a till-only role keeps only Open POS Billing",
);
const viewOnlyCustomers = new Set(["customers.view"]);
assert.deepEqual(
  quickActionsAllowed(cashierActions, (p) => viewOnlyCustomers.has(p)),
  [],
  "Create Customer needs customers.create as well as customers.view",
);

// 2. Every dashboard quick action declares what it needs.
for (const file of [
  "src/components/dashboard/cashier-dashboard-client.tsx",
  "src/components/dashboard/admin-dashboard-client.tsx",
  "src/components/dashboard/production-dashboard-client.tsx",
  "src/components/dashboard/purchasing-dashboard-client.tsx",
]) {
  const source = read(file);
  const block = source.match(/const actions = \[([\s\S]*?)\];/);
  assert.ok(block, `${file}: actions list found`);
  const entries = (block[1].match(/href:/g) ?? []).length;
  const declared = (block[1].match(/requires: \[PERMISSIONS\./g) ?? []).length;
  assert.ok(entries > 0, `${file}: has quick actions`);
  assert.equal(declared, entries, `${file}: every quick action declares requires`);
}
const cashier = read("src/components/dashboard/cashier-dashboard-client.tsx");
assert.match(cashier, /requires: \[PERMISSIONS\.customersView, PERMISSIONS\.customersCreate\]/);
assert.match(cashier, /requires: \[PERMISSIONS\.paymentsView, PERMISSIONS\.paymentsAdd\]/);
assert.match(
  read("src/components/dashboard/dashboard-quick-actions.tsx"),
  /quickActionsAllowed\(actions, hasPermission\)/,
  "the quick actions card filters",
);
assert.match(
  read("src/components/dashboard/admin-dashboard-client.tsx"),
  /allowedActions\.map\(/,
  "the admin dashboard renders only allowed actions",
);

// 3. The till's bakery-order button needs the orders permissions, not pos.sell.
const workspace = read("src/components/pos/pos-workspace.tsx");
assert.match(
  workspace,
  /canCreateBakeryOrder =\s*hasPermission\(PERMISSIONS\.ordersView\) && hasPermission\(PERMISSIONS\.ordersCreate\)/,
  "Create order needs orders.view and orders.create",
);

// 4. "View Journal" goes through the gated link everywhere outside Accounting.
assert.match(
  read("src/components/shared/accounting-reference-links.tsx"),
  /hasPermission\(PERMISSIONS\.accountingView\)/,
  "AccountingJournalLink checks accounting.view",
);
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const components = resolve(rootDir, "src/components");
for (const path of walk(components)) {
  if (!path.endsWith(".tsx")) continue;
  const relative = path.slice(components.length + 1).replaceAll("\\", "/");
  if (relative.startsWith("accounting/") || relative === "shared/accounting-reference-links.tsx") {
    continue;
  }
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    />\s*View Journal\s*</,
    `${relative}: renders its own View Journal link; use AccountingJournalLink`,
  );
}

console.log("dead-end actions: ok");
