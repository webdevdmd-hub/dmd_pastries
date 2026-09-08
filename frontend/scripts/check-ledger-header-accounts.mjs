/**
 * A header account groups other accounts and carries no postings of its own.
 * The seeded chart has four (50 Cost of Sales, 60 Operating Expenses,
 * 62 Finance Costs, 63 Tax Expense), and every posting picker listed them --
 * the expense picker sorted 60 to the top, so it was the first thing anyone
 * would choose.
 *
 * Recording an expense against it produced a balanced journal that the trial
 * balance had no row for: the bank credit appeared, the expense debit did not,
 * and the report announced "Debit / credit mismatch" for a ledger that was
 * correct. Verified live on production 2026-09-08.
 *
 * isLedgerAllowedForContext gates all three posting contexts, so the rule
 * belongs there once. This checks it stays.
 *
 * Usage: node scripts/check-ledger-header-accounts.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(rootDir, "src/lib/selectors/eligibility.ts");
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
  throw new Error(`Unexpected runtime import while loading eligibility: ${specifier}`);
});

const { isLedgerAllowedForContext } = moduleState.exports;

function account(overrides = {}) {
  return {
    accountCode: "6010",
    accountGroup: "operating_expense",
    accountName: "Rent Expense",
    accountType: "expense",
    allowManualPosting: true,
    id: "acc-1",
    isHeader: false,
    status: "active",
    ...overrides,
  };
}

const contexts = ["journal_line_account", "purchase_line_account", "expense_category_account"];

for (const context of contexts) {
  assert.equal(
    isLedgerAllowedForContext(account({ accountCode: "60", isHeader: true }), context),
    false,
    `${context} still offers header account 60; posting to it yields a journal the trial balance cannot show`,
  );

  assert.equal(
    isLedgerAllowedForContext(account(), context),
    true,
    `${context} stopped offering a normal leaf expense account`,
  );
}

// The pre-existing gates must survive the new one.
assert.equal(
  isLedgerAllowedForContext(account({ status: "inactive" }), "expense_category_account"),
  false,
  "inactive accounts must stay out",
);
assert.equal(
  isLedgerAllowedForContext(account({ allowManualPosting: false }), "expense_category_account"),
  false,
  "accounts that disallow manual posting must stay out",
);
// A header that is otherwise perfect is still refused: isHeader is not a
// stand-in for allowManualPosting, and the seeded headers set it true.
assert.equal(
  isLedgerAllowedForContext(
    account({ allowManualPosting: true, isHeader: true, status: "active" }),
    "expense_category_account",
  ),
  false,
  "an active, manually-postable header is exactly the case that broke the trial balance",
);

console.log("  Ledger header accounts OK: no posting context offers a header account.");
