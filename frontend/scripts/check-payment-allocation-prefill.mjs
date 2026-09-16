/**
 * Editing a payment must keep the bills it already settled.
 *
 * The payment form clears its allocations when the supplier changes, because
 * they name that supplier's bills. Opening the form for editing also assigns
 * the supplier, so the clear ran right after the prefill, in the same update.
 *
 * Measured on production on 2026-09-16, editing the 540.00 payment that settled
 * QAF-INV-1001: the Bills tab showed 0.00 against that bill and the footer read
 * "AED 540.00 will be saved as supplier advance." Saving a reference number
 * would have unpaid a settled bill and booked the money as an advance.
 *
 * Sibling of check-dialog-form-reset.mjs: the same family of effect-ordering
 * bug, where editing looks right and the other path silently loses data -- here
 * it is the other way round, the form loses what it was given.
 *
 * Regression: ISSUE-031 — editing a payment silently turned a settled bill into an advance
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-payment-allocation-prefill.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/purchasing/payment-allocation-reset.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { shouldDiscardAllocations } = moduleState.exports;

// The case that was measured: the form opens for editing and the supplier it
// assigns is the one the prefilled allocations already belong to.
assert.equal(
  shouldDiscardAllocations("supplier-a", "supplier-a"),
  false,
  "opening an edit assigns the payment's own supplier; discarding there loses the settled bills",
);
assert.equal(
  shouldDiscardAllocations(null, "supplier-a"),
  false,
  "a form holding nothing has nothing to discard",
);
assert.equal(
  shouldDiscardAllocations("supplier-a", "supplier-b"),
  true,
  "another supplier's bills must not keep amounts typed against the first",
);
assert.equal(
  shouldDiscardAllocations("supplier-a", ""),
  true,
  "clearing the supplier clears its bills",
);

// --- The dialog uses the rule, and prefills once per payment -----------------

const dialog = read("src/components/purchasing/purchase-supplier-payment-allocation-dialog.tsx");

assert.match(
  dialog,
  /shouldDiscardAllocations\(allocationsHeldFor\.current, selectedSupplierId\)/,
  "the supplier-change effect must ask shouldDiscardAllocations, not clear on every assignment",
);
assert.doesNotMatch(
  dialog,
  /useEffect\(\(\) => \{\s*setAllocations\(\{\}\);/,
  "an unconditional clear on supplier change wipes the allocations the edit just prefilled",
);
assert.match(
  dialog,
  /prefilledFor\.current === paymentId\) return;/,
  "the prefill must run once per payment, so a background refetch does not overwrite typing",
);
assert.match(
  dialog,
  /setAllocations\(\s*initialPayment\s*\?\s*Object\.fromEntries\(/,
  "the form must prefill the payment's own allocations",
);

console.log("check-payment-allocation-prefill: editing a payment keeps the bills it settled.");
