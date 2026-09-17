/**
 * Staff role pickers offer only roles the current user may give, and the
 * small wording fixes from the Users audit hold.
 *
 * ISSUE-056 (owner decision 2026-09-17): you can only give a role whose
 * permissions you already hold. The server refuses the rest; the pickers mark
 * them "(beyond your access)" instead of offering a choice that fails.
 *
 * Also: the Create User dialog said "connected to the existing backend users
 * API"; statuses read "active" / "suspended" in lower case; an empty transfer
 * form said "Source and target accounts must be different."; the Balance
 * Sheet printed the heading "Equity" twice.
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-role-grants.mjs
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

const { isRoleGrantable } = load("src/lib/roles/grantable.ts");
const manager = ["users.view", "users.create", "pos.sell"];
assert.equal(isRoleGrantable(["pos.sell"], manager), true, "a Cashier-like role is grantable");
assert.equal(
  isRoleGrantable(["pos.sell", "accounting.view"], manager),
  false,
  "an Admin-like role is not",
);

const page = read("src/components/users/users-page-client.tsx");
assert.match(page, /grantable: isRoleGrantable\(role\.permissionKeys, heldPermissions\)/);
for (const path of [
  "src/components/users/user-form-dialog.tsx",
  "src/components/users/invite-user-dialog.tsx",
]) {
  assert.match(
    read(path),
    /disabled=\{roleOption\.grantable === false\}/,
    `${path} must not offer a role beyond the user's access`,
  );
}

const form = read("src/components/users/user-form-dialog.tsx");
assert.doesNotMatch(form, /backend users API/);
assert.match(form, /\{statusLabels\[status\]\}/);

const { accountTransferSchema } = await (async () => {
  // zod is imported by the schema; checked textually to avoid bundling it.
  return { accountTransferSchema: read("src/lib/validators/accounting.schema.ts") };
})();
assert.match(
  accountTransferSchema,
  /!value\.fromPaymentAccountId \|\|\s*!value\.toPaymentAccountId \|\|/,
  "two empty account pickers must not be reported as the same account",
);

const balanceSheet = read("src/components/accounting/balance-sheet-page-client.tsx");
assert.equal(
  balanceSheet.match(/\{groups\.length > 1 \|\| group\.group !== title \? \(/g)?.length,
  2,
  "a lone same-named group repeats neither its heading nor its total",
);

console.log("check-role-grants: pickers offer grantable roles; wording fixes hold.");
