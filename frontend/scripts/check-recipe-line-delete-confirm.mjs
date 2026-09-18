/**
 * Removing a saved recipe line asks first; deleting a recipe says its lines go.
 *
 * Regression: ISSUE-091 — recipe delete left its lines live, and saved recipe
 * lines were deleted on one click with only a toast afterwards.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * A saved line changes the recipe's cost (and so the product's cost and, with
 * automatic pricing, its price). A draft line is only local state and is
 * still removed at once.
 *
 * Usage: node scripts/check-recipe-line-delete-confirm.mjs
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

const { recipeDeleteConsequence, recipeLineDeleteConfirmation } = load(
  "src/lib/catalog/delete-confirmations.ts",
);

for (const [kind, label] of [
  ["ingredient", "Remove ingredient"],
  ["packaging", "Remove packaging"],
]) {
  const request = recipeLineDeleteConfirmation(kind, "Flour");
  assert.equal(request.title, "Remove Flour from this recipe?", `${kind}: names the line`);
  assert.match(
    request.consequence,
    new RegExp(`The ${kind} line is deleted`),
    `${kind}: says what`,
  );
  assert.match(request.consequence, /cost is recalculated/, `${kind}: says the cost changes`);
  assert.equal(request.confirmLabel, label, `${kind}: the confirm label names the action`);
  assert.equal(request.cancelLabel, "Keep line", `${kind}: the cancel label names the safe action`);
}
assert.match(
  recipeDeleteConsequence("Victoria sponge"),
  /^Victoria sponge and its ingredient and packaging lines are removed/,
  "the recipe delete says its lines go with it",
);

for (const [file, kind] of [
  ["src/components/recipes/recipe-ingredients-section.tsx", "ingredient"],
  ["src/components/recipes/recipe-packaging-section.tsx", "packaging"],
]) {
  const source = read(file);
  const body = source.match(/const deleteLine = async \([\s\S]*?\n {2}\};/);
  assert.ok(body, `${file}: deleteLine found`);
  const draftRemoved = body[0].indexOf("onDraftLinesChange?.(");
  const asked = body[0].indexOf(`await confirm(recipeLineDeleteConfirmation("${kind}", lineName))`);
  const deleted = body[0].indexOf("deleteMutation.mutateAsync(");
  assert.ok(asked !== -1, `${file}: asks before deleting a saved line`);
  assert.ok(
    draftRemoved !== -1 && draftRemoved < asked,
    `${file}: a draft line is removed at once`,
  );
  assert.ok(deleted > asked, `${file}: deletes only after the confirmation`);
}

const page = read("src/components/recipes/recipes-page-client.tsx");
assert.match(page, /recipeDeleteConsequence\(pendingAction\.recipe\.recipeName\)/, "recipe copy");
assert.match(page, /\? "Delete recipe" : "Confirm"/, "the recipe delete button names the action");
assert.ok(!page.includes("This removes the recipe from active BOM workflows."), "old copy gone");

console.log("recipe line delete confirm: ok");
