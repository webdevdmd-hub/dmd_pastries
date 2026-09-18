/**
 * The product delete dialog says what delete really does.
 *
 * Regression: ISSUE-086 — the dialog said a deleted product "is archived",
 * but it is soft-deleted: it never shows under the Archived filter and cannot
 * be restored.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Archive is a separate row action that keeps the product and its history;
 * the dialog must send people with history there, not promise it.
 *
 * Usage: node scripts/check-product-delete-copy.mjs
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

const { productDeleteConfirmation } = load("src/lib/catalog/delete-confirmations.ts");
const request = productDeleteConfirmation("Brownie");

assert.equal(request.title, "Delete Brownie?", "the title names the product");
assert.match(request.consequence, /removed from the catalogue and the till/, "says where it goes");
assert.match(request.consequence, /its variants/, "says the variants go too");
assert.match(request.consequence, /cannot be restored/, "says it cannot be undone");
assert.match(request.consequence, /archive it instead/, "sends history to Archive");
assert.doesNotMatch(request.consequence, /is archived/, "does not promise an archive");
assert.equal(request.confirmLabel, "Delete product", "the confirm label names the action");
assert.equal(request.cancelLabel, "Keep product", "the cancel label names the safe action");

const page = read("src/components/products/products-page-client.tsx");
assert.match(
  page,
  /confirmState\?\.action === "delete"\s*\?\s*productDeleteConfirmation\(confirmState\.product\.productName\)/,
  "the delete dialog takes its words from productDeleteConfirmation",
);
assert.match(
  page,
  /\{deleteCopy\s*\?\s*deleteCopy\.consequence/,
  "the description is the consequence",
);
assert.match(
  page,
  /\{deleteCopy \? deleteCopy\.confirmLabel : "Confirm"\}/,
  "the button names delete",
);
assert.ok(!page.includes('"The product is archived and removed from sale'), "the old copy is gone");

console.log("product delete copy: ok");
