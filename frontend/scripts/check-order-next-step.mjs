/**
 * A purchase order row's next step must reflect what has already happened.
 *
 * On production on 2026-09-16 PO-000001 -- received, billed as QAF-INV-1001
 * and paid in full -- read "Ready to bill", because the list response carried
 * no document chain. That instructs an operator to raise a second bill for
 * goods already billed and paid. The response now carries has_active_bill and
 * line counts (TODOS T-R).
 *
 * Regression: ISSUE-033 — a billed and paid purchase order said "Ready to bill"
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-order-next-step.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/purchasing/order-next-step.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", "require", transpiled.outputText)(
  moduleState.exports,
  moduleState,
  () => ({}),
);
const { nextStepForOrder } = moduleState.exports;

const all = { canConvertToBill: true, canReceiveOrder: true, canUpdateStatus: true };
const none = { canConvertToBill: false, canReceiveOrder: false, canUpdateStatus: false };
const order = (overrides) => ({
  status: "received",
  stockLineCount: 1,
  receivedLineCount: 1,
  unreceivedValue: 0,
  hasActiveBill: false,
  ...overrides,
});

assert.equal(
  nextStepForOrder(order({ hasActiveBill: true }), all),
  "Billed",
  "the measured case: PO-000001 was billed and paid, and must not say Ready to bill",
);
assert.equal(
  nextStepForOrder(order({}), all),
  "Ready to bill",
  "an unbilled received order is billable",
);
assert.equal(
  nextStepForOrder(order({}), none),
  "Received in full",
  "no bill permission, report the state",
);
assert.equal(
  nextStepForOrder(
    order({ status: "partially_received", stockLineCount: 3, receivedLineCount: 1 }),
    all,
  ),
  "Receive remaining goods (1 of 3 lines)",
  "partial receipt must say how far along it is",
);
assert.equal(
  nextStepForOrder(
    order({ status: "partially_received", stockLineCount: 0, receivedLineCount: 0 }),
    none,
  ),
  "Part delivered",
  "no line counts, no invented progress",
);

// Both list views must use the shared rule.
for (const file of [
  "src/components/purchasing/purchase-orders-table.tsx",
  "src/components/purchasing/purchase-orders-card-grid.tsx",
]) {
  assert.match(
    read(file),
    /nextStepForOrder\(order, actions\)/,
    `${file} must use nextStepForOrder`,
  );
}
assert.match(
  read("src/lib/api/purchasing.ts"),
  /hasActiveBill: value\.has_active_bill === true/,
  "the order parser must read has_active_bill",
);

console.log("check-order-next-step: order rows reflect billing and receiving progress.");
