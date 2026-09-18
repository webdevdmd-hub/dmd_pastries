/**
 * The supplier delete dialog says what happens to the items that use it.
 *
 * Deleting a supplier now clears it from the ingredients and packaging items
 * that name it as their supplier, in the same transaction; before, those
 * items kept pointing at a deleted supplier and every save failed with 404.
 * The dialog must say the items are left with no supplier, and keep saying
 * which suppliers cannot be deleted at all.
 *
 * Regression: ISSUE-088 — ingredients and packaging of a deleted supplier could not be saved
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-supplier-delete-copy.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const dialog = read("src/components/suppliers/supplier-status-confirm-dialog.tsx");
const deleteCopy = /\{isDelete\s*\?\s*"([^"]+)"/.exec(dialog)?.[1] ?? "";
assert.ok(deleteCopy, "the supplier delete copy was not found");

assert.match(
  deleteCopy,
  /ingredients and packaging items that name it as their supplier are left with none/,
  "the delete dialog must say ingredients and packaging items lose the supplier",
);
assert.match(
  deleteCopy,
  /Only a supplier with no purchase orders, bills or payments can be deleted/,
  "the delete dialog must still say which suppliers cannot be deleted",
);

console.log("check-supplier-delete-copy: the supplier delete dialog names what it clears.");
