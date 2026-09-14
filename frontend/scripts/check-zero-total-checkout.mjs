/**
 * A sale that comes to nothing must still be completable.
 *
 * A comp, a staff meal or a 100%-off promotion totals zero. Nothing is owed,
 * so there is nothing to tender. The register blocked that at three separate
 * layers on the way to the server:
 *
 *   1. resolveCheckoutBlocker: `payments.length === 0` demanded a payment
 *      method, and selecting one auto-filled 0.00, which `amount <= 0` then
 *      rejected as "Fix amount". No input satisfied both.
 *   2. checkoutSchema: `payments.min(1)` refused to even build the request,
 *      with "At least one payment is required."
 *   3. submitCheckout sent the auto-filled zero tender, which the server
 *      rejects outright (buildPayments: "payment amount must be > 0").
 *
 * The server was never the obstacle: Checkout refuses an empty payments list
 * only when TotalAmount > 0, so "no tender on a zero total" is the shape it
 * was built for.
 *
 * This check covers layers 1 and 2 together, because fixing only the blocker
 * looked correct in the UI -- the button read "Confirm sale" -- and still
 * failed on the schema when the sale was actually rung. A test that stops at
 * the blocker reports green over a register that cannot sell.
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
import { z } from "zod";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const moduleCache = new Map();

function loadModule(specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier);
  }

  const sourcePath = resolve(rootDir, `${specifier.replace("@/", "src/")}.ts`);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });

  const moduleState = { exports: {} };
  moduleCache.set(specifier, moduleState.exports);

  new Function("exports", "module", "require", transpiled.outputText)(
    moduleState.exports,
    moduleState,
    (request) => {
      if (request === "zod") {
        return { z };
      }
      if (request.startsWith("@/")) {
        return loadModule(request);
      }
      throw new Error(`Unexpected runtime import while loading POS checkout: ${request}`);
    },
  );

  moduleCache.set(specifier, moduleState.exports);
  return moduleState.exports;
}

const { resolveCheckoutBlocker } = loadModule("@/lib/pos/checkout-feedback");
const { checkoutSchema } = loadModule("@/lib/validators/pos.schema");

// --- Layer 1: the blocker that decides whether Confirm is armed -------------

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

function cashPayment(amount) {
  return {
    amount,
    methodType: CASH.methodType,
    paymentMethodId: CASH.id,
    paymentMethodName: CASH.methodName,
    referenceNumber: "",
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

assert.equal(
  blockerFor({ payments: [], total: 0 }),
  null,
  "a zero-total sale with no tender must arm Confirm: nothing is owed",
);

assert.equal(
  blockerFor({ payments: [cashPayment(0)], total: 0 }),
  null,
  "the register auto-fills 0.00 on a zero total; that is the right amount, not an error",
);

assert.equal(
  blockerFor({ payments: [], total: 0.00005 }),
  null,
  "a total that rounds away to nothing must behave as nothing owed",
);

const unpaidReal = blockerFor({ payments: [], total: 351 });
assert.ok(unpaidReal, "a real sale with no payment must still be blocked");
assert.equal(unpaidReal.buttonLabel, "Select payment");

const zeroOnReal = blockerFor({ payments: [cashPayment(0)], total: 351 });
assert.ok(zeroOnReal, "a zero tender on a real sale must still be blocked");
assert.equal(zeroOnReal.buttonLabel, "Fix amount");

const negativeOnZero = blockerFor({ payments: [cashPayment(-5)], total: 0 });
assert.ok(negativeOnZero, "a negative tender must be blocked even when nothing is owed");
assert.equal(negativeOnZero.buttonLabel, "Fix amount");

// --- Layer 2: the schema that builds the request ---------------------------
//
// The blocker arming Confirm is worth nothing if the payload cannot be built.

function payload(overrides = {}) {
  return {
    branchId: "branch-1",
    charges: [],
    checkoutReference: "3f1a6d9e-8c7b-4a2f-9f1d-2b6c5e4a7d80",
    customerId: null,
    externalOrderNumber: null,
    items: [
      {
        discountType: null,
        discountValue: null,
        productId: "product-1",
        productVariantId: null,
        quantity: 1,
        unitPrice: 351,
      },
    ],
    notes: null,
    payments: [],
    saleDiscountType: "percentage",
    saleDiscountValue: 100,
    salesChannelId: null,
    taxMode: null,
    ...overrides,
  };
}

const comped = checkoutSchema.safeParse(payload());
assert.ok(
  comped.success,
  `a comped sale must be sendable with no payments, got: ${comped.success ? "" : comped.error.issues[0]?.message}`,
);

// submitCheckout drops zero tenders before this point, so the array it sends
// is empty. A zero line that somehow survived must still be refused, because
// the server refuses it too.
const zeroLine = checkoutSchema.safeParse(payload({ payments: [cashPayment(0)] }));
assert.equal(zeroLine.success, false, "a zero-amount tender must not validate");

// An ordinary sale must still build.
const normal = checkoutSchema.safeParse(
  payload({ payments: [cashPayment(351)], saleDiscountType: null, saleDiscountValue: null }),
);
assert.ok(normal.success, "an ordinary paid sale must still validate");

// The cart itself is still required: an empty cart is not a sale.
const emptyCart = checkoutSchema.safeParse(payload({ items: [] }));
assert.equal(emptyCart.success, false, "an empty cart must not validate");

console.log("check-zero-total-checkout: a sale that owes nothing can be completed.");
