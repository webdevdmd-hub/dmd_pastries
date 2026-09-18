/**
 * Deleting a variant asks first, in both places the variants list appears.
 *
 * Regression: ISSUE-084 — the variant trash button deleted on one click, and
 * the server deleted variants with sales, stock or recipes.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * The product drawer and the full product page both render
 * ProductVariantsSection and each wired its trash button straight to the
 * delete mutation. The question now lives in the section, so neither page can
 * skip it.
 *
 * Usage: node scripts/check-variant-delete-confirm.mjs
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

const { variantDeleteConfirmation } = load("src/lib/catalog/delete-confirmations.ts");
const request = variantDeleteConfirmation("Chocolate Cake", "Large");

assert.equal(request.title, "Delete Large?", "the title names the variant");
assert.match(
  request.consequence,
  /removed from Chocolate Cake and from the till/,
  "says where it goes",
);
assert.match(
  request.consequence,
  /stock record leaves inventory/,
  "says the stock record goes too",
);
for (const blocker of ["sales", "orders", "stock on hand", "stock movements", "recipe"]) {
  assert.ok(request.consequence.includes(blocker), `names "${blocker}" as a refusal`);
}
assert.match(request.consequence, /set it to inactive instead/, "says what to do instead");
assert.equal(request.confirmLabel, "Delete variant", "the confirm label names the action");
assert.equal(request.cancelLabel, "Keep variant", "the cancel label names the safe action");

// The section asks before it hands the variant to either page's delete.
const section = read("src/components/products/product-variants-section.tsx");
const requestDelete = section.match(/const requestDelete = async \([\s\S]*?\n {2}\};/);
assert.ok(requestDelete, "requestDelete found");
assert.match(
  requestDelete[0],
  /if \(await confirm\(variantDeleteConfirmation\(product\.productName, variant\.variantName\)\)\) \{\s*onDelete\(variant\);/,
  "onDelete runs only after the confirmation",
);
assert.match(section, /void requestDelete\(variant\);/, "the trash button asks first");
assert.doesNotMatch(section, /onClick=\{\(\) => onDelete\(variant\)\}/, "no one-click delete");

// Both pages render the section, so both get the question.
assert.match(
  read("src/components/products/product-details-panel.tsx"),
  /<ProductVariantsSection[\s\S]*?onDelete=\{onDeleteVariant\}/,
  "the product page and drawer delete through the section",
);

console.log("variant delete confirm: ok");
