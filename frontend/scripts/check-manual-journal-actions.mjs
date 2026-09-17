/**
 * Manual journals can be reversed and, while still drafts, deleted; the
 * settlement deduction picker offers only postable accounts.
 *
 * Measured on production on 2026-09-17 with posted manual journal
 * JV-20260917-000001:
 *
 *   ISSUE-047  Reverse -> 400 "invalid request payload": the page sent no body.
 *   ISSUE-048  Delete showed on the posted journal and always failed. Owner
 *              decision: drafts only; posted journals are reversed.
 *   ISSUE-052  The settlement "Expense account" picker listed the header
 *              "60 - Operating Expenses", which takes no postings.
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-manual-journal-actions.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const api = read("src/lib/api/accounting.ts");
const reverse = api.slice(api.indexOf("export async function reverseJournalEntry"));
assert.match(
  reverse.slice(0, reverse.indexOf("\n}\n")),
  /body: \{\}/,
  "reverseJournalEntry must send a JSON body; the server rejects an empty request",
);

const page = read("src/components/accounting/journal-entries-page-client.tsx");
assert.match(
  page,
  /entry\.sourceType === "manual" && entry\.status === "draft" \? \(\s*<Button\s+className="border-danger\/30 text-danger-text/,
  "Delete must show only on draft manual journals",
);
assert.doesNotMatch(
  page,
  /\{canManage && entry\.sourceType === "manual" \? \(\s*<Button\s+className="border-danger\/30/,
  "Delete is offered on posted journals again",
);

const settlements = read("src/components/accounting/settlement-pages.tsx");
assert.match(
  settlements,
  /expenseAccounts\.filter\(\(account\) =>\s*isLedgerAllowedForContext\(account, "expense_category_account"\)/,
  "the settlement deduction picker must drop header and locked accounts",
);

console.log(
  "check-manual-journal-actions: reverse sends a body, delete is drafts only, no header accounts.",
);
