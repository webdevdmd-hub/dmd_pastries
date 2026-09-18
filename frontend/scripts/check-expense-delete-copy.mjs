/**
 * Deleting an expense says what the server really does.
 *
 * The dialog, the row menu and the toast all said the expense was
 * "permanently" deleted and that the journal entries were removed for good.
 * The server soft-deletes the expense and its journal entries: they leave the
 * books and the expense list, the rows stay in the database, and the delete is
 * written to the audit log with the expense number, amount and journal ids
 * (backend/internal/modules/expenses/service.go, Delete).
 *
 * Regression: ISSUE-081 — expense delete promised a permanent delete that never happens
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-expense-delete-copy.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/purchasing/expenses-page-client.tsx");
const menu = read("src/components/purchasing/expense-actions-menu.tsx");

for (const [file, source] of [
  ["expenses-page-client.tsx", page],
  ["expense-actions-menu.tsx", menu],
]) {
  assert.doesNotMatch(
    source,
    /permanent/i,
    `${file}: an expense is soft-deleted, so nothing may call the delete permanent`,
  );
}

// The dialog: from the confirm handler's dialog down to its closing tag.
const dialog = page.slice(page.indexOf("open={deleteTarget !== null}"));
assert.ok(dialog.length > 0, "the expense delete dialog was not found");
assert.match(
  dialog,
  /<DialogTitle>Delete expense\?<\/DialogTitle>/,
  "the dialog title asks about deleting the expense, nothing more",
);
assert.match(
  dialog,
  /journal entries out of the ledger/,
  "the dialog says the journal entries leave the ledger",
);
assert.match(dialog, /audit log/, "the dialog says the delete is kept in the audit log");
assert.match(dialog, />\s*Delete expense\s*</, "the confirm button names the action");

const toastCall = /toast\.success\("([^"]*)"\);\s*setDeleteTarget\(null\);/.exec(page)?.[1] ?? "";
assert.equal(toastCall, "Expense deleted.", "the success toast must not overstate the delete");

assert.match(menu, />\s*Delete expense\s*</, "the row menu offers Delete expense");

console.log("check-expense-delete-copy: the expense delete copy matches the soft delete.");
