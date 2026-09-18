/**
 * Regression: ISSUE-077 — a chart account still in use could be deleted
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * The server now refuses (409) to delete an account with postings, an account
 * mapping or a payment account behind it, and says what to do instead. The
 * chart of accounts must ask through the app confirm dialog, tell the user up
 * front which accounts are refused, and put the server's reason in front of
 * them when it refuses.
 *
 * Usage: node scripts/check-chart-account-delete.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/accounting/chart-of-accounts-page-client.tsx");

// The delete handler, bounded to its own body.
const start = page.indexOf("const deleteAccount = async (account: ChartAccount)");
assert.ok(start >= 0, "the page has a deleteAccount handler");
const end = page.indexOf("\n  };\n", start);
const handler = page.slice(start, end);

assert.match(handler, /await confirm\(\{/, "deleting asks through the app confirm dialog");
assert.match(handler, /confirmLabel: "Delete account"/, "the confirm button names the action");
assert.match(handler, /cancelLabel: "Keep account"/, "the safe button names the safe action");
assert.doesNotMatch(
  handler,
  /permanently|cannot be undone/i,
  "the copy does not overstate the delete",
);
assert.match(
  handler,
  /detail:\s*"An account with postings, child accounts, an account mapping or a payment account cannot be deleted\. Deactivate it instead\."/,
  "the dialog says which accounts the server refuses, and what to do instead",
);

// Asked first, deleted second, and a refusal reaches the user verbatim.
const asked = handler.indexOf("await confirm(");
const deleted = handler.indexOf("deleteMutation.mutateAsync(account.id)");
assert.ok(deleted > asked, "the delete runs only after the confirm");
assert.match(
  handler.slice(deleted),
  /catch \(error: unknown\) \{\s*toast\.error\(getErrorMessage\(error\)\);/,
  "a 409 from the delete shows the server's message",
);

// Every entry point goes through the handler; nothing deletes behind it.
assert.equal(
  (page.match(/deleteMutation\.mutateAsync\(/g) ?? []).length,
  1,
  "deleteAccount is the only place the page deletes",
);
assert.equal(
  (page.match(/void deleteAccount\(/g) ?? []).length,
  2,
  "both the detail panel and the phone drawer menu call deleteAccount",
);

// The status dialog that remains names its action too.
assert.doesNotMatch(page, />\s*Confirm\s*</, 'no button on the page is labelled "Confirm"');

console.log("check-chart-account-delete: ok");
