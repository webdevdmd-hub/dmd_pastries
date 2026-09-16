/**
 * The expense form starts on a real branch, warns only about real gaps, keeps
 * its error message true as fields are fixed, and names what Delete removes.
 *
 * Measured on production on 2026-09-16, recording an expense as the owner:
 *
 *   ISSUE-036  the form opened on branch "all" -- the scope filter, not a
 *              branch -- so it read "Select branch", warned "Configure an
 *              active payment account for this branch" although Main Branch
 *              had three, and "Branch is required" never fired.
 *   ISSUE-037  after a failed submit, filling every field left the message
 *              "Expense account is required. Paid through account is
 *              required. Amount must be greater than zero." and the
 *              "Expense 3" badge in place until the next click.
 *   (delete)   "Delete expense permanently?" named neither the expense nor
 *              its amount, where the payment delete names both.
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-expense-form.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/purchasing/expense-form.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { initialExpenseBranchId, isRecordableBranchId } = moduleState.exports;

const branches = [
  { id: "closed", status: "inactive" },
  { id: "main", status: "active" },
];

assert.equal(
  isRecordableBranchId("all"),
  false,
  '"all" is a filter, not a branch to record against',
);
assert.equal(isRecordableBranchId(""), false);
assert.equal(isRecordableBranchId("main"), true);
assert.equal(
  initialExpenseBranchId("all", branches),
  "main",
  'the measured case: an all-branches owner starts on the first active branch, not on "all"',
);
assert.equal(initialExpenseBranchId("main", branches), "main", "a user's own branch wins");
assert.equal(initialExpenseBranchId("gone", branches), "main", "a stale default falls back");
assert.equal(initialExpenseBranchId("all", []), "", "no branches, no guess");

const page = read("src/components/purchasing/expenses-page-client.tsx");

assert.match(
  page,
  /defaultBranchId=\{initialExpenseBranchId\(branchScope\.defaultBranchId, branchOptions\)\}/,
  'the form must be given a recordable branch, not the scope\'s "all"',
);
assert.match(
  page,
  /const hasNoPaidThroughOptions =\s*isRecordableBranchId\(formState\.branchId\) &&/,
  "the payment-account warning must only fire for a real branch",
);
assert.match(
  page,
  /if \(!isRecordableBranchId\(payload\.branchId\)\) \{\s*found\.push\(\{ fieldId: "expenses-branch"/,
  '"Branch is required" must treat "all" as no branch',
);
assert.match(
  page,
  /if \(!open \|\| !validationShown\) return;\s*showValidation\(collectValidationErrors\(buildPayload\(formState\)\)\);/,
  "after a failed submit the message and badges must be recomputed as fields change",
);
assert.match(
  page,
  /deleteTarget\.expenseNumber[\s\S]{0,120}formatExpenseAmount\(deleteTarget\.amount\)/,
  "the delete confirmation must name the expense and its amount",
);
assert.doesNotMatch(
  page,
  /This removes the expense and backend-generated journal entries\./,
  "the anonymous delete wording is back",
);

console.log(
  "check-expense-form: branch default, warnings, live validation and delete wording hold.",
);
