import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("src/lib/selectors/eligibility.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

const context = {
  exports: {},
  require: () => {
    throw new Error("Unexpected runtime import in eligibility selector check.");
  },
};
vm.runInNewContext(compiled.outputText, context);

const {
  getProductPosVisibilityLabel,
  getProductVariantPosVisibilityLabel,
  isPosSelectableProduct,
  isPosSelectableProductVariant,
} = context.exports;

function product(overrides = {}) {
  return {
    id: "product-id",
    productName: "Test Product",
    productCode: "PRD-TEST",
    sku: null,
    barcode: null,
    description: null,
    categoryId: "category-id",
    categoryName: "Category",
    unitId: "unit-id",
    unitName: "Piece",
    taxRateId: null,
    taxRateName: null,
    taxRateStatus: null,
    productType: "finished_product",
    itemStructure: "single",
    salePrice: 10,
    costPrice: null,
    compareAtPrice: null,
    costUpdatePolicy: "manual",
    pricingType: "markup",
    pricingPercent: 0,
    minimumSalePrice: null,
    suggestedSalePrice: null,
    autoPriceUpdateEnabled: false,
    salePriceLocked: false,
    lastPurchaseCost: null,
    lastPurchaseDate: null,
    lastProductionCost: null,
    lastProductionDate: null,
    averageInventoryCost: null,
    imageUrl: null,
    imageFileId: null,
    isSellable: true,
    isPosVisible: true,
    isPurchasable: false,
    isStockTracked: false,
    isExpiryTracked: false,
    isCustomOrderAvailable: false,
    preparationTimeMinutes: null,
    status: "active",
    variants: [],
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
    ...overrides,
  };
}

assert.equal(isPosSelectableProduct(product()), true);
assert.equal(getProductPosVisibilityLabel(product()), "POS Visible");
assert.notEqual(
  getProductPosVisibilityLabel(
    product({ isSellable: false, isPosVisible: true, productType: "ingredient" }),
  ),
  "POS Visible",
);
assert.equal(
  getProductPosVisibilityLabel(
    product({ isSellable: false, isPosVisible: true, productType: "packaging" }),
  ),
  "Packaging Item",
);
assert.equal(getProductPosVisibilityLabel(product({ isPosVisible: false })), "Hidden from POS");
assert.notEqual(getProductPosVisibilityLabel(product({ status: "inactive" })), "POS Visible");
assert.equal(
  isPosSelectableProductVariant(product(), {
    id: "variant-id",
    productId: "product-id",
    variantName: "Small",
    sku: null,
    barcode: null,
    salePrice: 10,
    costPrice: null,
    costUpdatePolicy: "manual",
    pricingType: "markup",
    pricingPercent: 0,
    minimumSalePrice: null,
    suggestedSalePrice: null,
    autoPriceUpdateEnabled: false,
    salePriceLocked: false,
    lastPurchaseCost: null,
    lastPurchaseDate: null,
    lastProductionCost: null,
    lastProductionDate: null,
    averageInventoryCost: null,
    imageUrl: null,
    imageFileId: null,
    sortOrder: 1,
    status: "inactive",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
  }),
  false,
);
assert.equal(
  getProductVariantPosVisibilityLabel(product(), {
    id: "variant-id",
    productId: "product-id",
    variantName: "Small",
    sku: null,
    barcode: null,
    salePrice: 10,
    costPrice: null,
    costUpdatePolicy: "manual",
    pricingType: "markup",
    pricingPercent: 0,
    minimumSalePrice: null,
    suggestedSalePrice: null,
    autoPriceUpdateEnabled: false,
    salePriceLocked: false,
    lastPurchaseCost: null,
    lastPurchaseDate: null,
    lastProductionCost: null,
    lastProductionDate: null,
    averageInventoryCost: null,
    imageUrl: null,
    imageFileId: null,
    sortOrder: 1,
    status: "inactive",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
  }),
  "Hidden from POS",
);

console.log("Product POS label checks passed.");
