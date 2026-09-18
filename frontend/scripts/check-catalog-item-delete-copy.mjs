/**
 * Ingredient and packaging deletes say what happens to the stock record.
 *
 * Regression: ISSUE-083 — packaging delete left the item's inventory row in
 * stock valuation and low-stock alerts; ingredient delete was refused whenever
 * the ingredient had an inventory row, which creating it always makes.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * The server now retires an empty inventory row with the item and refuses an
 * item with stock history. Both pages said only "This soft-deletes the item
 * from active catalog workflows" behind a button labelled "Confirm". This pins
 * the words to what the server does, and the pages to asking before deleting.
 *
 * Usage: node scripts/check-catalog-item-delete-copy.mjs
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

const { ingredientDeleteConfirmation, packagingDeleteConfirmation } = load(
  "src/lib/catalog/delete-confirmations.ts",
);

const cases = [
  {
    name: "ingredient",
    request: ingredientDeleteConfirmation("Butter"),
    item: "Butter",
    blockers: [
      "stock on hand",
      "stock movements",
      "expiry batches",
      "purchase documents",
      "recipe",
    ],
  },
  {
    name: "packaging",
    request: packagingDeleteConfirmation("Cake box"),
    item: "Cake box",
    blockers: [
      "stock on hand",
      "stock movements",
      "purchase documents",
      "packaging rules",
      "recipe",
    ],
  },
];

for (const { name, request, item, blockers } of cases) {
  assert.match(request.title, new RegExp(item), `${name}: the title names the item`);
  assert.match(
    request.consequence,
    /stock record leaves inventory/,
    `${name}: says the empty stock record goes with the item`,
  );
  for (const blocker of blockers) {
    assert.ok(request.consequence.includes(blocker), `${name}: names "${blocker}" as a refusal`);
  }
  assert.match(request.consequence, /deactivate it instead/, `${name}: says what to do instead`);
  assert.doesNotMatch(request.consequence, /soft-delete/i, `${name}: no implementation jargon`);
  assert.notEqual(request.confirmLabel, "Confirm", `${name}: the confirm label names the action`);
  assert.match(request.confirmLabel, /^Delete /, `${name}: the confirm label is the delete`);
  assert.notEqual(request.cancelLabel, "Cancel", `${name}: the cancel label names the safe action`);
}

// Each page asks through useConfirm before it deletes, and shows the server's
// refusal (which names what holds the item) rather than a generic line.
for (const [file, builder] of [
  ["src/components/ingredients/ingredients-page-client.tsx", "ingredientDeleteConfirmation"],
  ["src/components/packaging/packaging-page-client.tsx", "packagingDeleteConfirmation"],
]) {
  const source = read(file);
  const body = source.match(/const deleteItem = async \([\s\S]*?\n {2}\};/);
  assert.ok(body, `${file}: deleteItem found`);
  const asked = body[0].indexOf(`await confirm(${builder}(`);
  const deleted = body[0].indexOf("deleteMutation.mutateAsync(");
  assert.ok(asked !== -1, `${file}: asks with ${builder}`);
  assert.ok(deleted > asked, `${file}: deletes only after the confirmation`);
  assert.match(body[0], /toast\.error\(getErrorMessage\(error\)\)/, `${file}: shows the refusal`);
  assert.match(
    source,
    /onDelete=\{\(item\) => \{\s*void deleteItem\(item\);/,
    `${file}: row wired`,
  );
  assert.ok(!source.includes('"This soft-deletes the'), `${file}: the old copy is gone`);
}

console.log("catalog item delete copy: ok");
