import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- Minimal module loader for the app's `@/` sources -----------------------

const moduleCache = new Map();

function loadModule(specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier);
  }

  const sourcePath = resolve(rootDir, `${specifier.replace("@/", "src/")}.ts`);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const moduleState = { exports: {} };
  moduleCache.set(specifier, moduleState.exports);

  new Function("exports", "module", "require", transpiled.outputText)(
    moduleState.exports,
    moduleState,
    requireShim,
  );

  moduleCache.set(specifier, moduleState.exports);
  return moduleState.exports;
}

// `usePOSCart` is a React hook, so React is stubbed: `useState` hands back
// seeded state plus a recording setter, and `useMemo` simply runs its factory.
// That makes the totals memo directly observable for a given cart fixture.
let stateQueue = [];
let stateIndex = 0;
let setterCalls = [];

const reactStub = {
  useState(initial) {
    const index = stateIndex;
    stateIndex += 1;
    const value = index < stateQueue.length ? stateQueue[index] : initial;
    return [value, (updater) => setterCalls.push({ index, updater })];
  },
  useMemo(factory) {
    return factory();
  },
};

function requireShim(specifier) {
  if (specifier === "react") {
    return reactStub;
  }

  if (specifier.startsWith("@/")) {
    return loadModule(specifier);
  }

  throw new Error(`Unexpected runtime import while loading POS cart: ${specifier}`);
}

const { usePOSCart } = loadModule("@/hooks/use-pos-cart");

function runCart({
  items = [],
  saleDiscountType = null,
  saleDiscountValue = null,
  charges = [],
  payments = [],
} = {}) {
  stateQueue = [items, saleDiscountType, saleDiscountValue, charges, payments];
  stateIndex = 0;
  setterCalls = [];
  return usePOSCart();
}

// Applies whichever `setItems` updater the hook produced to a starting array,
// exercising the real `calculateLine` path instead of hand-built fixtures.
function applyItemsUpdate(currentItems) {
  assert.equal(setterCalls.length, 1, "expected exactly one cart state update");
  const call = setterCalls[0];
  assert.equal(call.index, 0, "expected the items state to be updated");
  return call.updater(currentItems);
}

function makeProduct(overrides = {}) {
  return {
    id: "product-a",
    productName: "Croissant",
    sku: "CRS-1",
    imageUrl: null,
    imageFileId: null,
    salePrice: 10,
    taxRatePercentage: 0,
    taxRateName: null,
    taxRateIsInclusive: false,
    variants: [],
    ...overrides,
  };
}

function addToCart(product, existingItems = []) {
  const cart = runCart({ items: existingItems });
  cart.addProduct({ product });
  return applyItemsUpdate(existingItems);
}

function setQuantity(items, cartItemId, quantity) {
  const cart = runCart({ items });
  cart.updateQuantity(cartItemId, quantity);

  if (setterCalls.length === 0) {
    return null; // update was rejected as invalid
  }

  return applyItemsUpdate(items);
}

function setLineDiscount(items, cartItemId, discountType, discountValue) {
  const cart = runCart({ items });
  cart.applyLineDiscount(cartItemId, discountType, discountValue);
  return applyItemsUpdate(items);
}

// --- A1: the sale discount must reduce tax, mirroring the Go backend --------
// backend/internal/modules/pos/service.go allocates the sale discount
// proportionally per line and taxes the discounted line amount.

{
  // A 100% sale discount must zero out the tax and the total.
  let items = addToCart(makeProduct({ taxRatePercentage: 5 }));
  items = setQuantity(items, "product-a:base", 2);

  const { totals } = runCart({
    items,
    saleDiscountType: "percentage",
    saleDiscountValue: 100,
  });

  assert.equal(totals.subtotal, 20, "subtotal should stay at the pre-discount amount");
  assert.equal(totals.discountAmount, 20);
  assert.equal(totals.taxAmount, 0, "a fully discounted sale must not carry tax");
  assert.equal(totals.total, 0, "a 100% discount must yield a zero total");
}

{
  // A partial sale discount reduces tax proportionally.
  const items = addToCart(makeProduct({ salePrice: 100, taxRatePercentage: 10 }));

  const { totals } = runCart({
    items,
    saleDiscountType: "percentage",
    saleDiscountValue: 20,
  });

  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discountAmount, 20);
  assert.equal(totals.taxAmount, 8, "tax is charged on 80.00, not on the pre-discount 100.00");
  assert.equal(totals.total, 88);
}

{
  // The discount is allocated per line, so lines with different tax rates
  // are taxed on their own discounted amount.
  let items = addToCart(makeProduct({ id: "taxed", salePrice: 100, taxRatePercentage: 10 }));
  items = addToCart(makeProduct({ id: "untaxed", salePrice: 100, taxRatePercentage: 0 }), items);

  const { totals } = runCart({
    items,
    saleDiscountType: "fixed",
    saleDiscountValue: 50,
  });

  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discountAmount, 50);
  assert.equal(totals.taxAmount, 7.5, "only the taxed line's discounted 75.00 is taxed");
  assert.equal(totals.total, 157.5);
}

{
  // Tax-inclusive rates back the tax out of the price instead of adding it.
  const items = addToCart(
    makeProduct({ salePrice: 105, taxRatePercentage: 5, taxRateIsInclusive: true }),
  );

  const { totals } = runCart({ items });

  assert.equal(totals.taxAmount, 5, "inclusive tax is extracted from the price");
  assert.equal(totals.total, 105, "inclusive tax must not be added on top");
}

// --- A2: discounts can never inflate a total -------------------------------

{
  // A negative fixed line discount must not raise the line total.
  const items = setLineDiscount(
    addToCart(makeProduct({ salePrice: 20 })),
    "product-a:base",
    "fixed",
    -10,
  );

  assert.equal(items[0].discountAmount, 0, "a negative discount clamps to zero");
  assert.equal(items[0].lineTotal, 20, "the line total must not be inflated");
}

{
  // A negative sale discount must not raise the cart total.
  const items = addToCart(makeProduct({ salePrice: 20 }));
  const { totals } = runCart({
    items,
    saleDiscountType: "fixed",
    saleDiscountValue: -10,
  });

  assert.equal(totals.discountAmount, 0);
  assert.equal(totals.total, 20);
}

{
  // Upper bounds still hold: percentages cap at 100, fixed caps at the subtotal.
  const base = addToCart(makeProduct({ salePrice: 20 }));

  assert.equal(setLineDiscount(base, "product-a:base", "percentage", 150)[0].discountAmount, 20);
  assert.equal(setLineDiscount(base, "product-a:base", "fixed", 999)[0].discountAmount, 20);
}

// --- A3: fractional quantities for weight-priced goods ---------------------

{
  const base = addToCart(makeProduct({ salePrice: 20 }));

  const halfKilo = setQuantity(base, "product-a:base", 0.5);
  assert.equal(halfKilo[0].quantity, 0.5, "fractional quantities must be preserved");
  assert.equal(halfKilo[0].lineSubtotal, 10);

  const fineGrained = setQuantity(base, "product-a:base", 0.125);
  assert.equal(fineGrained[0].quantity, 0.125);
  assert.equal(fineGrained[0].lineSubtotal, 2.5);

  // Invalid quantities are rejected outright rather than poisoning the cart.
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      setQuantity(base, "product-a:base", invalid),
      null,
      `quantity ${String(invalid)} must be rejected`,
    );
  }
}

// --- Charges and payment balances ------------------------------------------

{
  const items = addToCart(makeProduct({ salePrice: 100, taxRatePercentage: 10 }));

  const { totals } = runCart({
    items,
    charges: [{ amount: 15, taxRatePercentage: 20 }],
    payments: [{ amount: 200 }],
  });

  assert.equal(totals.chargeAmount, 15);
  assert.equal(totals.chargeTaxAmount, 3);
  assert.equal(totals.total, 128, "100 + 10 tax + 15 charge + 3 charge tax");
  assert.equal(totals.paidAmount, 200);
  assert.equal(totals.changeAmount, 72);
  assert.equal(totals.balanceDue, 0);
}

{
  // Underpayment leaves a balance and no change.
  const items = addToCart(makeProduct({ salePrice: 100 }));
  const { totals } = runCart({ items, payments: [{ amount: 40 }] });

  assert.equal(totals.balanceDue, 60);
  assert.equal(totals.changeAmount, 0);
}

console.log("POS cart totals checks passed.");
