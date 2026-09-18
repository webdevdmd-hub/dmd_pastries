/**
 * The Staff delete dialog and toast say what delete really does.
 *
 * Regression: ISSUE-075. Deleting a staff user said it "removes the staff
 * account from the active users list", while the Supabase login stayed,
 * banned, holding the person's email and phone, so they could never be added
 * again. Delete now removes the login and erases the account when there is no
 * history to keep; the toast says which of the two happened, from the API's
 * `erased` flag.
 *
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-staff-delete-copy.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/users/users-page-client.tsx");
assert.doesNotMatch(
  page,
  /removes the staff account from the active users list/,
  "the dialog no longer claims delete only hides the account",
);
assert.match(page, /Their login is removed/, "the dialog says the login is removed");
assert.match(
  page,
  /const result = await deleteUserMutation\.mutateAsync\(deleteDialogUser\.id\);[\s\S]{0,400}result\.erased/,
  "the toast follows the API's erased flag",
);

const api = read("src/lib/api/users.ts");
assert.match(api, /erased: result\.erased === true/, "the delete response parser keeps erased");
assert.match(
  read("src/types/user.ts"),
  /erased: boolean;/,
  "the delete result type carries erased",
);

console.log("staff delete copy: ok");
