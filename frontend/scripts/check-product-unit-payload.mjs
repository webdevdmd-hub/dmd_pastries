import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDir, "src/lib/api/products.ts");
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
  if (specifier === "@/lib/api/client") {
    return {
      apiRequest: () => {
        throw new Error("apiRequest must not run in product unit payload checks.");
      },
    };
  }
  if (specifier === "@/types/product") {
    return {
      ITEM_STRUCTURES: ["single", "variant", "recipe_based", "custom"],
      PRODUCT_TYPES: [
        "finished_product",
        "ingredient",
        "packaging",
        "raw_material",
        "semi_finished",
        "consumable",
        "equipment",
        "service",
      ],
    };
  }

  throw new Error(`Unexpected runtime import while loading product API helpers: ${specifier}`);
});

const { toBackendProductPayload } = moduleState.exports;

const piecePayload = toBackendProductPayload({
  productName: "QA Piece Product",
  categoryId: "category-id",
  unitId: "piece-unit-id",
  taxRateId: null,
  productType: "finished_product",
  itemStructure: "single",
  salePrice: 10,
  costPrice: null,
  costUpdatePolicy: "manual",
  pricingType: "markup",
  pricingPercent: 0,
  minimumSalePrice: null,
  autoPriceUpdateEnabled: false,
  salePriceLocked: false,
  sku: null,
  barcode: null,
  description: null,
  imageUrl: null,
  imageFileId: null,
  isSellable: true,
  isPosVisible: true,
  isPurchasable: false,
  isStockTracked: true,
  isExpiryTracked: false,
  isCustomOrderAvailable: false,
  preparationTimeMinutes: null,
});

assert.equal(piecePayload.unit_id, "piece-unit-id");
assert.equal(piecePayload.product_name, "QA Piece Product");
assert.equal(piecePayload.category_id, "category-id");
assert.equal(Object.hasOwn(piecePayload, "unitId"), false);

const kilogramPayload = toBackendProductPayload({ unitId: "kilogram-unit-id" });
assert.deepEqual(kilogramPayload, { unit_id: "kilogram-unit-id" });

console.log("Product unit payload checks passed.");
