/**
 * Regression: ISSUE-079 — a payment account used as a branch account could
 * be deleted, and the delete dialog misdescribed what deleting does
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Deleting a payment account is a soft delete that also removes its opening
 * balance entry, and the server refuses while a payment method uses it, as
 * its default or at a branch. The dialog said it "permanently deletes" the
 * account, "cannot be undone", and that linked methods would merely need a
 * new account.
 *
 * Usage: node scripts/check-payment-account-delete.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const panel = read("src/components/accounting/payment-accounts-panel.tsx");
const start = panel.indexOf("const deleteAccount = async (account: PaymentAccount)");
assert.ok(start >= 0, "the panel has a deleteAccount handler");
const handler = panel.slice(start, panel.indexOf("\n  };\n", start));

const confirmCall = handler.slice(handler.indexOf("await confirm({"), handler.indexOf("});"));
assert.ok(confirmCall.length > 0, "deleting asks through the app confirm dialog");
assert.doesNotMatch(
  confirmCall,
  /permanently|cannot be undone/i,
  "a soft delete must not be described as permanent",
);
assert.doesNotMatch(
  confirmCall,
  /will need a new account/,
  "linked payment methods block the delete; they are not left needing an account",
);
assert.match(
  confirmCall,
  /account\.openingJournalEntryId\s*\?\s*`This removes \$\{account\.accountName\} and its opening balance entry\./,
  "the opening balance entry the delete removes is named when there is one",
);
assert.match(
  confirmCall,
  /as its default account or at a branch/,
  "the dialog says a payment method using the account, by default or at a branch, blocks the delete",
);
assert.match(
  handler,
  /catch \(error\) \{\s*toast\.error\(getErrorMessage\(error\)\);/,
  "the server's refusal reaches the user",
);

console.log("check-payment-account-delete: ok");
