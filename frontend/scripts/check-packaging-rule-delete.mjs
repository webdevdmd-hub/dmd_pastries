/**
 * Removing a packaging usage rule asks first and says how it went.
 *
 * Regression: ISSUE-094 — DELETE /packaging/product/:pid/:ruleId ran on one
 * click with no confirmation, no success toast, and failures were silent.
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * The button called deleteMutation.mutateAsync and discarded the promise, so
 * a rejected delete went nowhere.
 *
 * Usage: node scripts/check-packaging-rule-delete.mjs
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

const { packagingRuleDeleteConfirmation } = load("src/lib/catalog/delete-confirmations.ts");
const request = packagingRuleDeleteConfirmation("Cake box", "Chocolate Cake");
assert.equal(request.title, "Remove Cake box from Chocolate Cake?", "names both sides");
assert.match(request.consequence, /Chocolate Cake uses Cake box is deleted/, "says what goes");
assert.match(request.consequence, /Stock and past records are not changed/, "says what stays");
assert.equal(request.confirmLabel, "Remove rule", "the confirm label names the action");
assert.equal(request.cancelLabel, "Keep rule", "the cancel label names the safe action");

const section = read("src/components/packaging/packaging-usage-section.tsx");
const body = section.match(/const deleteRule = async \([\s\S]*?\n {2}\};/);
assert.ok(body, "deleteRule found");
const asked = body[0].indexOf("await confirm(packagingRuleDeleteConfirmation(");
const deleted = body[0].indexOf("await deleteMutation.mutateAsync(");
assert.ok(asked !== -1, "asks first");
assert.ok(deleted > asked, "deletes only after the confirmation, and awaits it");
assert.match(body[0], /toast\.success\("Packaging usage rule deleted\."\)/, "reports success");
assert.match(
  body[0],
  /catch \(error\) \{\s*toast\.error\(getErrorMessage\(error\)\);/,
  "reports failure",
);
assert.match(section, /void deleteRule\(rule\);/, "the trash button goes through deleteRule");
assert.doesNotMatch(
  section,
  /void deleteMutation\.mutateAsync\(/,
  "no fire-and-forget delete is left",
);

console.log("packaging rule delete: ok");
