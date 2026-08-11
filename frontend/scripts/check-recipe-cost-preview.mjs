import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDir, "src/lib/recipes/recipe-cost-preview.ts");
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
  throw new Error(`Unexpected runtime import while loading recipe cost preview: ${specifier}`);
});

const { calculateRecipeLiveCostPreview } = moduleState.exports;

const componentProducts = [
  {
    barcode: null,
    costPrice: 10,
    id: "ingredient-a",
    isStockTracked: true,
    itemStructure: "single",
    productCode: "ING-A",
    productName: "Ingredient A",
    productType: "ingredient",
    sku: null,
    unitId: "unit",
    unitName: "Unit",
    unitSymbol: "u",
    variants: [],
  },
  {
    barcode: null,
    costPrice: 2,
    id: "ingredient-b",
    isStockTracked: true,
    itemStructure: "single",
    productCode: "ING-B",
    productName: "Ingredient B",
    productType: "ingredient",
    sku: null,
    unitId: "unit",
    unitName: "Unit",
    unitSymbol: "u",
    variants: [],
  },
];

function preview(overrides = {}) {
  return calculateRecipeLiveCostPreview({
    batchYieldQuantity: 10,
    componentProducts,
    ingredients: [
      {
        componentProductId: "ingredient-a",
        componentVariantId: null,
        quantityRequired: 10,
        unitId: "unit",
        wastagePercentage: 0,
      },
    ],
    packaging: [],
    ...overrides,
  });
}

assert.equal(preview().estimatedTotalCost, 100);
assert.equal(preview().costPerYieldUnit, 10);
assert.equal(preview({ batchYieldQuantity: 20 }).costPerYieldUnit, 5);
assert.equal(preview({ batchYieldQuantity: "20" }).costPerYieldUnit, 5);

const invalidYield = preview({ batchYieldQuantity: "" });
assert.equal(invalidYield.yieldQuantityValid, false);
assert.equal(invalidYield.costPerYieldUnit, 0);

const zeroYield = preview({ batchYieldQuantity: 0 });
assert.equal(zeroYield.yieldQuantityValid, false);
assert.equal(zeroYield.costPerYieldUnit, 0);

const wastagePreview = preview({
  batchYieldQuantity: "2",
  ingredients: [
    {
      componentProductId: "ingredient-b",
      componentVariantId: null,
      quantityRequired: "4",
      unitId: "unit",
      wastagePercentage: "25",
    },
  ],
});
assert.equal(wastagePreview.estimatedIngredientCost, 10);
assert.equal(wastagePreview.costPerYieldUnit, 5);

const packagingPreview = preview({
  batchYieldQuantity: "2",
  ingredients: [],
  packaging: [
    {
      componentProductId: null,
      componentVariantId: null,
      quantityRequired: "3",
      unitCostSnapshot: "2.5",
      unitId: "unit",
    },
  ],
});
assert.equal(packagingPreview.estimatedPackagingCost, 7.5);
assert.equal(packagingPreview.costPerYieldUnit, 3.75);

const mismatchPreview = preview({
  ingredients: [
    {
      componentProductId: "ingredient-a",
      componentVariantId: null,
      quantityRequired: 1,
      unitId: "other-unit",
      wastagePercentage: 0,
    },
  ],
});
assert.equal(mismatchPreview.hasUnitMismatch, true);

console.log("Recipe cost preview checks passed.");
