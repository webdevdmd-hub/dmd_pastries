/**
 * Editing a product keeps its own category and unit, even once deactivated.
 *
 * Regression: ISSUE-089 — the product form offered deactivated units and
 * categories, and saving with an inactive category failed.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * /lookups now returns active units and categories only. A product filed under
 * one that has since been deactivated would then find no matching option: the
 * form blanked the field and would not save. The server accepts the unchanged
 * inactive value, so the form must keep offering it.
 *
 * Usage: node scripts/check-product-form-inactive-references.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");
const load = (path) => {
  const out = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const state = { exports: {} };
  new Function("exports", "module", out.outputText)(state.exports, state);
  return state.exports;
};

const { productCategoryOptions, productUnitOptions } = load(
  "src/lib/products/reference-options.ts",
);

const cakes = { id: "c-cakes", categoryName: "Cakes", allowedProductTypes: ["finished_product"] };
const kilogram = { id: "u-kg", unitName: "Kilogram", symbol: "kg" };
const seasonalBrownie = {
  categoryId: "c-seasonal",
  categoryName: "Seasonal",
  productType: "finished_product",
  unitId: "u-tray",
  unitName: "Tray",
};

// A product in a deactivated category and unit keeps them as options.
assert.deepEqual(productCategoryOptions([cakes], seasonalBrownie), [
  cakes,
  {
    id: "c-seasonal",
    categoryName: "Seasonal (inactive)",
    allowedProductTypes: ["finished_product"],
  },
]);
assert.deepEqual(productUnitOptions([kilogram], seasonalBrownie), [
  { id: "u-kg", label: "Kilogram (kg)" },
  { id: "u-tray", label: "Tray (inactive)" },
]);

// Nothing is added for a new product, or when the current value is active.
assert.deepEqual(productCategoryOptions([cakes], null), [cakes]);
assert.deepEqual(productUnitOptions([kilogram], null), [{ id: "u-kg", label: "Kilogram (kg)" }]);
const activeBrownie = { ...seasonalBrownie, categoryId: "c-cakes", unitId: "u-kg" };
assert.deepEqual(productCategoryOptions([cakes], activeBrownie), [cakes]);
assert.equal(productUnitOptions([kilogram], activeBrownie).length, 1);

// The form offers and validates against these options, not the raw lookups.
const form = read("src/components/products/product-form-dialog.tsx");
assert.match(form, /productCategoryOptions\(referenceData\.categories, product\)/, "categories");
assert.match(form, /productUnitOptions\(referenceData\.units, product\)/, "units");
assert.match(form, /categoryOptions\.filter\(/, "compatible categories come from the options");
assert.match(form, /unitOptions\.some\(\(unit\) => unit\.id === selectedUnitId\)/, "unit check");
assert.match(form, /\{unitOptions\.map\(\(unit\) => \(/, "the unit select renders the options");
assert.doesNotMatch(form, /referenceData\.units\.map\(/, "no raw unit list in the select");

console.log("product form inactive references: ok");
