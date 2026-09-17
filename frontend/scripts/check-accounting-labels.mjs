/**
 * Accounting screens say what the numbers are, in words people use.
 *
 * Measured on production on 2026-09-16 and 2026-09-17:
 *
 *   ISSUE-053  Journal sources read "Pos Sale Cogs"; account pickers read
 *              "asset · current_asset · debit"; mappings were titled
 *              "accounts_payable"; the Balance Sheet printed "Total for
 *              Equity" twice and 0.00 against every group heading; Opening
 *              Balances showed 1,350.00 unallocated with every category 0.00
 *              (opening stock had no line); the transfer form named one
 *              missing field per try; "backend" appeared across the pages.
 *   ISSUE-054  Reconciliation: the Inventory, Accounts payable and Accounts
 *              receivable sections always said "0 checks, All matched" --
 *              while Accounts Payable was unmatched by 270.00.
 *   ISSUE-055  Profit & Loss labelled every income and expense "Operating"
 *              and printed "Non Operating Income/Expense 0.00" regardless.
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-accounting-labels.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/accounting/labels.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { accountOptionDescription, humanizeAccountingValue, journalSourceLabel } =
  moduleState.exports;

assert.equal(journalSourceLabel("pos_sale_cogs"), "POS Sale COGS", "the measured source label");
assert.equal(journalSourceLabel("bakery_order_revenue"), "Bakery Order Revenue");
assert.equal(humanizeAccountingValue("current_asset"), "current asset");
assert.equal(
  accountOptionDescription({
    accountGroup: "current_asset",
    accountType: "asset",
    normalBalance: "debit",
  }),
  "asset · current asset · debit",
  "the measured picker line",
);

const api = read("src/lib/api/accounting.ts");
assert.match(
  api,
  /if \(typeof value\.check_key === "string"\) \{\s*return \[parseReconciliationItem\(value\)\];/,
  "single-check reconciliation responses (/inventory, /ap, /ar) must become one row",
);

const recovery = read("src/components/accounting/accounting-recovery-pages.tsx");
assert.match(
  recovery,
  /new Map\(\s*responses\.flatMap\(\(response\) => response\?\.items \?\? \[\]\)\.map\(\(item\) => \[item\.id, item\]\),?\s*\)/,
  "the summary must count each check once; the health check repeats three of them",
);
assert.match(
  recovery,
  /\{mapping\.description \|\| humanizeAccountingValue\(mapping\.mappingKey\)\}/,
);

const profitLoss = read("src/components/accounting/profit-loss-page-client.tsx");
assert.doesNotMatch(profitLoss, /Non Operating (Income|Expense)/, "hard-coded zero rows are back");
assert.doesNotMatch(
  profitLoss,
  /title="Operating (Income|Expense)"/,
  "sections are mislabelled again",
);

const balanceSheet = read("src/components/accounting/balance-sheet-page-client.tsx");
assert.match(
  balanceSheet,
  /\{groups\.length > 1 \|\| group\.group !== title \? \(/,
  'a single same-named group must not print "Total for Equity" twice',
);
assert.doesNotMatch(balanceSheet, /\{group\.group\}<\/td>\s*<AmountCell value=\{0\} \/>/);

const openingBalances = read("src/components/accounting/opening-balances-page-client.tsx");
assert.match(openingBalances, /<FieldLabel>Opening stock<\/FieldLabel>/);

const settlements = read("src/components/accounting/settlement-pages.tsx");
assert.match(
  settlements,
  /parsed\.error\.issues\.map\(\(issue\) => issue\.message\)/,
  "the transfer form must name every missing field at once",
);

// No "backend" in text people read on the accounting pages.
const componentDir = resolve(rootDir, "src/components/accounting");
const offenders = [];
for (const file of readdirSync(componentDir).filter((name) => name.endsWith(".tsx"))) {
  read(`src/components/accounting/${file}`)
    .split("\n")
    .forEach((line, index) => {
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("{/*");
      if (!isComment && /\b[Bb]ackend\b/.test(line) && !/throw new Error/.test(line)) {
        offenders.push(`${file}:${String(index + 1)}: ${trimmed}`);
      }
    });
}
assert.deepEqual(
  offenders,
  [],
  `"backend" in user-facing accounting text:\n${offenders.join("\n")}`,
);

console.log("check-accounting-labels: statements, reconciliation and pickers read correctly.");
