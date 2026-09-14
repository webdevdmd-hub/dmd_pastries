/**
 * A sale that comes to nothing must still be completable.
 *
 * A comp, a staff meal or a 100%-off promotion totals zero. Nothing is owed,
 * so there is nothing to tender. The register used to block that twice over:
 * `payments.length === 0` demanded a payment method, and selecting one filled
 * the amount with 0.00, which `amount <= 0` then rejected as "Fix amount".
 * No input satisfied both, so the only way through was to record taking cash
 * and handing the same cash straight back -- a cash movement that never
 * happened, posted to the ledger.
 *
 * The backend was never the obstacle: Checkout only refuses an empty payments
 * list when TotalAmount > 0, so "no tender on a zero total" is the shape it
 * expects. buildPayments does reject a zero-amount line, which is why
 * submitCheckout filters zero tenders out rather than sending them.
 *
 * Regression: ISSUE-001 — a zero-total sale could not be completed
 * Found by /qa on 2026-09-14
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
 *
 * Usage: node scripts/check-zero-total-checkout.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(here, "..", "src/lib/pos/checkout-feedback.ts");

// checkout-feedback.ts imports only types, which transpile away, so the module
// runs standalone with no stubs. If that ever stops being true this throws
// rather than silently testing a mock.
const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

const moduleState = { exports: {} };
new Function("exports", "module", "require", transpiled.outputText)(
  moduleState.exports,
  moduleState,
  (specifier) => {
    throw new Error(`checkout-feedback gained a runtime import (${specifier}); update this check`);
  },
);

const { resolveCheckoutBlocker } = moduleState.exports;
assert.equal(
  typeof resolveCheckoutBlocker,
  "function",
  "resolveCheckoutBlocker is no longer exported",
);

const CASH = {
  defaultPaymentAccountId: "account-1",
  id: "method-cash",
  methodName: "Cash",
  methodType: "cash",
  requiresReference: false,
  showInPos: true,
  status: "active",
};

function totals(total) {
  return {
    chargeAmount: 0,
    chargeTaxAmount: 0,
    discountAmount: 0,
    itemDiscountAmount: 0,
    paidAmount: 0,
    saleDiscountAmount: 0,
    subtotal: total,
    taxAmount: 0,
    total,
  };
}

function blockerFor({ payments = [], total }) {
  return resolveCheckoutBlocker({
    branchId: "branch-1",
    externalOrderNumber: "",
    itemCount: 1,
    paymentMethods: [CASH],
    paymentMethodsError: null,
    payments,
    salesChannelId: "",
    salesChannels: [],
    totals: totals(total),
  });
}

function cashPayment(amount) {
  return {
    amount,
    paymentMethodId: CASH.id,
    paymentMethodName: CASH.methodName,
    methodType: CASH.methodType,
    referenceNumber: "",
  };
}

// The regression: nothing owed, nothing tendered, nothing to fix.
assert.equal(
  blockerFor({ total: 0, payments: [] }),
  null,
  "a zero-total sale with no tender must be completable: nothing is owed",
);

// The register auto-selects a method and fills 0.00 before the cashier touches
// anything. That is the correct amount here, not an error to be corrected.
assert.equal(
  blockerFor({ total: 0, payments: [cashPayment(0)] }),
  null,
  "a zero tender on a zero-total sale must be accepted; submitCheckout drops it",
);

// Money is rounded to the fils, so a crumb below half a fils is still nothing.
assert.equal(
  blockerFor({ total: 0.00005, payments: [] }),
  null,
  "a total that rounds to nothing must behave as nothing owed",
);

// Guard the other direction: the fix must not let a real sale through unpaid.
const unpaidReal = blockerFor({ total: 351, payments: [] });
assert.ok(unpaidReal, "a real sale with no payment must still be blocked");
assert.equal(unpaidReal.buttonLabel, "Select payment");

const zeroOnReal = blockerFor({ total: 351, payments: [cashPayment(0)] });
assert.ok(zeroOnReal, "a zero tender on a real sale must still be blocked");
assert.equal(zeroOnReal.buttonLabel, "Fix amount");

// A negative amount is wrong whatever the total.
const negativeOnZero = blockerFor({ total: 0, payments: [cashPayment(-5)] });
assert.ok(negativeOnZero, "a negative tender must be blocked even when nothing is owed");
assert.equal(negativeOnZero.buttonLabel, "Fix amount");

console.log("check-zero-total-checkout: a sale that owes nothing can be completed.");
