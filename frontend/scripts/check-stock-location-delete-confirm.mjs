/**
 * Deleting a stock location asks first and says what refuses it.
 *
 * Regression: ISSUE-085 — a stock location could be deleted with stock
 * arriving or a draft transfer pending, and the trash button deleted on one
 * click.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-stock-location-delete-confirm.mjs
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

const { stockLocationDeleteConfirmation } = load("src/lib/catalog/delete-confirmations.ts");
const request = stockLocationDeleteConfirmation("Cold room");

assert.equal(request.title, "Delete Cold room?", "the title names the location");
assert.match(request.consequence, /still holds stock/, "names stock as a refusal");
assert.match(request.consequence, /draft transfer/, "names a draft transfer as a refusal");
assert.match(request.consequence, /default location cannot be deleted/, "names the default");
assert.equal(request.confirmLabel, "Delete location", "the confirm label names the action");
assert.equal(request.cancelLabel, "Keep location", "the cancel label names the safe action");

const page = read("src/components/inventory/stock-locations-page-client.tsx");
const handler = page.match(/const handleDelete = async \([\s\S]*?\n {2}\};/);
assert.ok(handler, "handleDelete found");
const asked = handler[0].indexOf(
  "await confirm(stockLocationDeleteConfirmation(location.locationName))",
);
const deleted = handler[0].indexOf("deleteMutation.mutateAsync(");
assert.ok(asked !== -1, "asks with stockLocationDeleteConfirmation");
assert.ok(deleted > asked, "deletes only after the confirmation");
assert.match(handler[0], /toast\.error\(getErrorMessage\(error\)\)/, "shows the server's reason");

console.log("stock location delete confirm: ok");
