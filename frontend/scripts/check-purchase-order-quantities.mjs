import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDir, "src/lib/purchasing/purchase-order-quantities.ts");
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleState = { exports: {} };
const moduleFactory = new Function("exports", "module", "require", transpiled.outputText);

moduleFactory(moduleState.exports, moduleState, (specifier) => {
  throw new Error(
    `Unexpected runtime import while loading purchase order quantities: ${specifier}`,
  );
});

const {
  hasOutstandingStock,
  isStockLine,
  outstandingQuantity,
  receivingProgress,
  totalsByUnit,
  unreceivedValue,
} = moduleState.exports;

function stockLine(overrides) {
  return {
    id: "line",
    lineType: "product",
    itemType: "product",
    quantityOrdered: 0,
    quantityReceived: 0,
    unitCost: 0,
    unitSymbol: "kg",
    unitName: "Kilogram",
    ...overrides,
  };
}

function accountLine(overrides) {
  return stockLine({ itemType: "account", lineType: "account", ...overrides });
}

// --- outstandingQuantity ----------------------------------------------------

assert.equal(
  outstandingQuantity(stockLine({ quantityOrdered: 500, quantityReceived: 300 })),
  200,
  "a partially received line still owes the difference",
);

assert.equal(
  outstandingQuantity(stockLine({ quantityOrdered: 200, quantityReceived: 200 })),
  0,
  "a fully received line owes nothing",
);

assert.equal(
  outstandingQuantity(stockLine({ quantityOrdered: 100, quantityReceived: 140 })),
  0,
  "an over-receipt never reports a negative outstanding quantity",
);

assert.equal(
  outstandingQuantity(accountLine({ quantityOrdered: 1, quantityReceived: 0 })),
  0,
  "account rows buy an expense, not stock, so nothing is ever outstanding on them",
);

assert.equal(isStockLine(accountLine({})), false, "account rows are not stock lines");
assert.equal(isStockLine(stockLine({})), true, "product rows are stock lines");

// --- hasOutstandingStock ----------------------------------------------------

const partialOrder = {
  items: [
    stockLine({ id: "a", quantityOrdered: 500, quantityReceived: 300, unitCost: 3.85 }),
    stockLine({ id: "b", quantityOrdered: 200, quantityReceived: 200, unitCost: 4.2 }),
    stockLine({ id: "c", quantityOrdered: 80, quantityReceived: 0, unitCost: 24.5 }),
    accountLine({ id: "d", quantityOrdered: 1, quantityReceived: 0, unitCost: 150 }),
  ],
};

assert.equal(hasOutstandingStock(partialOrder), true, "two lines are still outstanding");

assert.equal(
  hasOutstandingStock({
    items: [
      stockLine({ quantityOrdered: 10, quantityReceived: 10 }),
      accountLine({ quantityOrdered: 1, quantityReceived: 0 }),
    ],
  }),
  false,
  "an unreceived account row must not keep a fully received order open",
);

// --- unreceivedValue --------------------------------------------------------

assert.equal(
  unreceivedValue(partialOrder),
  200 * 3.85 + 80 * 24.5,
  "un-received value prices only the outstanding stock quantities",
);

assert.equal(
  unreceivedValue({ items: [accountLine({ quantityOrdered: 1, unitCost: 150 })] }),
  0,
  "account rows contribute nothing to un-received value",
);

// --- receivingProgress ------------------------------------------------------

assert.deepEqual(
  receivingProgress(partialOrder),
  { completeLines: 1, stockLines: 3 },
  "progress counts stock lines only, and counts them in lines rather than pooled quantity",
);

assert.deepEqual(
  receivingProgress({ items: [] }),
  { completeLines: 0, stockLines: 0 },
  "an order with no lines reports no progress rather than dividing by zero",
);

// --- totalsByUnit -----------------------------------------------------------

assert.deepEqual(
  totalsByUnit([
    { quantity: 200, unit: "kg" },
    { quantity: 80, unit: "kg" },
    { quantity: 12, unit: "L" },
  ]),
  [
    { quantity: 280, unit: "kg" },
    { quantity: 12, unit: "L" },
  ],
  "quantities add up within a unit and never across units",
);

assert.deepEqual(
  totalsByUnit([
    { quantity: 0, unit: "kg" },
    { quantity: -5, unit: "kg" },
    { quantity: Number.NaN, unit: "L" },
    { quantity: 3, unit: "kg" },
  ]),
  [{ quantity: 3, unit: "kg" }],
  "zeroed, negative and unparseable rows contribute nothing to the summary",
);

assert.deepEqual(totalsByUnit([]), [], "nothing to receive summarises to nothing");

console.log("Purchase order quantity checks passed.");
