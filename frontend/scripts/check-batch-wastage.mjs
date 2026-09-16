/**
 * "Record wastage" on a production batch writes off finished goods, and is
 * offered only where it can succeed.
 *
 * Measured on production on 2026-09-16 (ISSUE-044): the action appeared only on
 * completed batch MFG-000001, and the server answered "only planned or
 * in_progress batches can record wastage". The dialog asked for an inventory
 * item and a free-text "wastage type" the server ignored, and sent the reason
 * under a key it never read. The batch's Wastage tab could not load either:
 * the response had no list in it. Owner decision the same day: batch wastage
 * takes the output out of stock and posts it to Wastage Expense.
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-batch-wastage.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/manufacturing/batch-status.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { batchWastageRemaining, canRecordBatchWastage } = moduleState.exports;

assert.equal(
  typeof canRecordBatchWastage,
  "function",
  "batch-status must decide where wastage is offered",
);

const batch = (status, producedQuantity, wastageQuantity = 0) => ({
  status,
  producedQuantity,
  wastageQuantity,
});

assert.equal(
  canRecordBatchWastage(batch("completed", 1)),
  true,
  "the measured case: a produced batch with output left can write it off",
);
for (const status of ["draft", "planned", "in_progress", "cancelled"]) {
  assert.equal(
    canRecordBatchWastage(batch(status, 0)),
    false,
    `a ${status} batch has no finished goods to waste`,
  );
}
assert.equal(
  canRecordBatchWastage(batch("completed", 10, 10)),
  false,
  "a batch already written off in full offers nothing more",
);
assert.equal(batchWastageRemaining(batch("completed", 10, 2.5)), 7.5);
assert.equal(batchWastageRemaining(batch("completed", 10, 12)), 0);

for (const [path, pattern] of [
  [
    "src/components/manufacturing/batch-actions-menu.tsx",
    /canRecordWastage && canRecordBatchWastage\(batch\)/,
  ],
  [
    "src/components/manufacturing/batch-details-drawer.tsx",
    /canRecordWastage && canRecordBatchWastage\(batch\)/,
  ],
  [
    "src/components/manufacturing/batch-header.tsx",
    /canRecordWastage && canRecordBatchWastage\(batch\)/,
  ],
]) {
  assert.match(read(path), pattern, `${path} must offer wastage only where the server accepts it`);
}

const dialog = read("src/components/manufacturing/batch-wastage-dialog.tsx");
assert.doesNotMatch(dialog, /Wastage type/, "the ignored free-text wastage type is back");
assert.doesNotMatch(
  dialog,
  /Select item/,
  "the ignored item picker is back: wastage is the batch's own output",
);
assert.match(
  dialog,
  /batchWastageRemaining\(batch\)/,
  "the dialog must cap the quantity at what is left",
);

const api = read("src/lib/api/manufacturing.ts");
assert.doesNotMatch(
  api,
  /inventory_item_id: payload\.inventoryItemId/,
  "the wastage payload still sends an item",
);
assert.match(
  api,
  /export async function addBatchWastage[\s\S]{0,400}parse: parseBatch/,
  "the server answers a write-off with the batch",
);

assert.match(
  read("src/lib/inventory/stock-movement-display.ts"),
  /referenceType === "production_wastage"[\s\S]{0,120}Written off from Production Batch/,
  "a write-off must name its batch in the stock ledger",
);

console.log(
  "check-batch-wastage: wastage is offered on produced batches and sends what the server reads.",
);
