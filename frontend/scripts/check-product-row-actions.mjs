/**
 * A product row offers only the actions the signed-in role may take.
 *
 * Regression: ISSUE-065. The products menu showed Edit, Manage variants,
 * Deactivate, Archive and Delete to anyone holding any product write
 * permission, and the server accepted them all behind one guard. On
 * production on 2026-09-18 a role holding only products.view +
 * products.create deleted a product. The server now checks one permission per
 * route; this pins the menu to the same rule.
 *
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
 *
 * Usage: node scripts/check-product-row-actions.mjs
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

const { productRowActions } = load("src/lib/products/product-actions.ts");
const none = {
  canCreate: false,
  canEdit: false,
  canUpdateStatus: false,
  canDelete: false,
  canManageVariants: false,
};

// The exact role from the QA run: create but nothing else. No menu at all.
assert.deepEqual(
  productRowActions({ ...none, canCreate: true }, "active"),
  [],
  "products.create alone offers no row action",
);
assert.deepEqual(
  productRowActions({ ...none, canEdit: true }, "active"),
  ["edit"],
  "products.edit offers Edit only",
);
assert.deepEqual(
  productRowActions({ ...none, canDelete: true }, "active"),
  ["delete"],
  "products.delete offers Delete only",
);
assert.deepEqual(
  productRowActions({ ...none, canUpdateStatus: true }, "active"),
  ["status", "archive"],
  "products.status.update offers Deactivate and Archive",
);
assert.deepEqual(
  productRowActions({ ...none, canUpdateStatus: true }, "archived"),
  ["status"],
  "an archived product cannot be archived again",
);
assert.deepEqual(
  productRowActions({ ...none, canManageVariants: true }, "active"),
  ["variants"],
  "products.variants.manage offers Manage variants only",
);
assert.deepEqual(
  productRowActions(
    {
      canCreate: true,
      canEdit: true,
      canUpdateStatus: true,
      canDelete: true,
      canManageVariants: true,
    },
    "active",
  ),
  ["edit", "variants", "status", "archive", "delete"],
  "a full products role keeps every action",
);

// The menu must render from productRowActions, not from a single flag.
const menu = read("src/components/products/product-actions-menu.tsx");
assert.match(menu, /productRowActions\(permissions, product\.status\)/, "menu derives its items");
assert.doesNotMatch(menu, /canManage/, "menu no longer takes a single canManage flag");

console.log("product row actions: ok");
