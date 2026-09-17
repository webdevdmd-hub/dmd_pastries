/**
 * The Roles page matches what the server allows, and says it plainly.
 *
 * Measured on production on 2026-09-17:
 *   ISSUE-058  Custom roles had no Delete action (QA probe role could not be
 *              removed), though the server and the hook support it.
 *   ISSUE-056  The permission matrix let an editor tick permissions they do
 *              not hold and edit their own role; the server now refuses both.
 *   ISSUE-059  "The current backend requires at least one permission",
 *              "actions exposed by the backend permissions API", a disabled
 *              Status field "not currently exposed as a persisted backend
 *              field", and descriptions like "Audit_logs View".
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-roles-page.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");
const out = ts.transpileModule(read("src/lib/roles/grantable.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const state = { exports: {} };
new Function("exports", "module", out.outputText)(state.exports, state);
const { rolePermissionChangeBlockedReason } = state.exports;

const manager = { permissions: ["pos.sell", "users.view"], roles: ["Manager"] };
assert.match(
  rolePermissionChangeBlockedReason({ permissionKeys: ["pos.sell"], roleName: "Manager" }, manager),
  /your own role/,
);
assert.match(
  rolePermissionChangeBlockedReason(
    { permissionKeys: ["pos.sell", "accounting.view"], roleName: "Supervisor" },
    manager,
  ),
  /permissions you don't have/,
);
assert.equal(
  rolePermissionChangeBlockedReason({ permissionKeys: ["pos.sell"], roleName: "Cashier" }, manager),
  null,
);

const menu = read("src/components/roles/role-actions-menu.tsx");
assert.match(menu, /const showDelete = canDelete && !role\.isSystemDefault;/);
assert.match(menu, /Delete role/);

const page = read("src/components/roles/roles-page-client.tsx");
assert.match(page, /canDelete: canDeleteRoles,/);
assert.match(page, /deleteRoleMutation\.mutateAsync\(deleteTarget\.id\)/);
assert.match(page, /rolePermissionChangeBlockedReason\(selectedRole, user\)/);
assert.match(page, /heldPermissionKeys=\{user\?\.permissions \?\? \[\]\}/);

const matrix = read("src/components/roles/permission-matrix.tsx");
assert.match(matrix, /matrixDisabled \|\| \(!checked && !canGrant\(permission\.permissionKey\)\)/);

const form = read("src/components/roles/role-form-dialog.tsx");
assert.doesNotMatch(form, /name="status"/, "the fake read-only status field is back");

const offenders = [];
for (const file of readdirSync(resolve(rootDir, "src/components/roles"))) {
  read(`src/components/roles/${file}`)
    .split("\n")
    .forEach((line, index) => {
      const trimmed = line.trim();
      const comment =
        trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("{/*");
      if (!comment && /\b[Bb]ackend\b/.test(line)) offenders.push(`${file}:${String(index + 1)}`);
    });
}
assert.deepEqual(offenders, [], `"backend" in user-facing roles text: ${offenders.join(", ")}`);

console.log("check-roles-page: delete, grant limits and wording hold.");
