/**
 * Deleting a supplier payment must describe what it paid for truthfully.
 *
 * On production on 2026-09-16, deleting a 100.00 advance asked to confirm
 * deleting "the AED 100.00 payment to QA Flour Co on invoice Supplier payment".
 * There is no such invoice: the payment named no bill, so the parser's
 * placeholder was printed as if it were a bill number, at the one step that
 * cannot be undone.
 *
 * Regression: ISSUE-034 — deleting an advance confirmed a payment "on invoice Supplier payment"
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-supplier-payment-subject.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/purchasing/supplier-payment-subject.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", "require", transpiled.outputText)(
  moduleState.exports,
  moduleState,
  () => ({}),
);
const { supplierPaymentSubject, SUPPLIER_PAYMENT_WITHOUT_BILL } = moduleState.exports;

assert.equal(
  supplierPaymentSubject({
    allocatedAmount: 0,
    invoiceNumber: SUPPLIER_PAYMENT_WITHOUT_BILL,
    unappliedAmount: 100,
  }),
  "held as supplier advance",
  "the measured case: an advance names no bill",
);
assert.equal(
  supplierPaymentSubject({
    allocatedAmount: 540,
    invoiceNumber: "QAF-INV-1001",
    unappliedAmount: 0,
  }),
  "against bill QAF-INV-1001",
);
assert.equal(
  supplierPaymentSubject({
    allocatedAmount: 500,
    invoiceNumber: SUPPLIER_PAYMENT_WITHOUT_BILL,
    unappliedAmount: 40,
  }),
  "against supplier bills, part held as supplier advance",
  "the placeholder is never printed as a bill number",
);

const page = read("src/components/purchasing/purchase-supplier-payments-page-client.tsx");
assert.doesNotMatch(
  page,
  /on invoice \$\{payment\.invoiceNumber\}/,
  "the delete confirmation prints invoiceNumber as a bill again; an advance has none",
);
assert.match(
  page,
  /supplierPaymentSubject\(payment\)/,
  "the delete confirmation must use supplierPaymentSubject",
);

console.log("check-supplier-payment-subject: payment confirmations name what was actually paid.");
