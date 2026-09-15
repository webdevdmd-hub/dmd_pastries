/**
 * Purchasing pickers must offer exactly the suppliers the server accepts.
 *
 * ISSUE-021 let the server pay a deactivated supplier's posted bill, as the
 * Deactivate dialog promises. Verified live on 2026-09-15: paying QAF-INV-1001
 * from the bill drawer returned 201 while QA Flour Co was inactive. But the
 * Payments Made screen could not reach it. Its supplier picker read
 * /suppliers/lookup, which returned active suppliers only, so it showed
 * "No matching suppliers found." The server fix was unreachable from the main
 * payments screen, and every supplier filter on Orders, Receipts, Bills,
 * Returns and Payments silently dropped the supplier's history.
 *
 * The same list was capped at 20 and searched in the browser, so a business
 * with 21 suppliers could never pick the 21st in any purchasing screen.
 *
 * This is the fourth time in this audit a fix landed at one layer while the
 * bug stayed live at another. So this pins the frontend table to the backend
 * function itself, parsed from source, not to a transcription of it.
 *
 * Regression: ISSUE-023 — purchasing supplier pickers hid inactive suppliers the server accepts
 * Regression: ISSUE-024 — purchasing supplier pickers stopped at 20 suppliers
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-purchasing-supplier-use.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(rootDir, "..");

function read(path) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function loadModule(specifier) {
  const sourcePath = resolve(rootDir, `${specifier.replace("@/", "src/")}.ts`);
  const transpiled = ts.transpileModule(read(sourcePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const moduleState = { exports: {} };
  new Function("exports", "module", "require", transpiled.outputText)(
    moduleState.exports,
    moduleState,
    () => ({}),
  );
  return moduleState.exports;
}

const { supplierAllows, supplierOptionsFor } = loadModule("@/lib/purchasing/supplier-use");

// --- 1. The table matches the server, read from the server's source ----------

const STATUSES = ["active", "inactive", "blocked"];
const USE_NAMES = {
  supplierUseNewDocument: "new_document",
  supplierUseOpenDocument: "open_document",
  supplierUsePayment: "payment",
  supplierUseView: "history",
};

const service = read(resolve(repoRoot, "backend/internal/modules/purchasing/service.go"));
const start = service.indexOf("func supplierAllows(");
assert.ok(start !== -1, "supplierAllows not found in purchasing/service.go");
const body = service.slice(start, service.indexOf("\n}\n", start));

const serverTable = {};
for (const match of body.matchAll(/(case ([\w, ]+)|default):\s*\n\s*return ([^\n]+)/g)) {
  const allowed = [...match[3].matchAll(/status == "(\w+)"/g)].map((m) => m[1]);
  const uses = match[2]
    ? match[2].split(",").map((name) => USE_NAMES[name.trim()])
    : Object.values(USE_NAMES).filter((use) => !(use in serverTable));
  for (const use of uses) {
    assert.ok(use, `unknown supplierUse constant in: ${match[0]}`);
    serverTable[use] = allowed;
  }
}
assert.equal(
  Object.keys(serverTable).length,
  4,
  `parsed ${String(Object.keys(serverTable).length)} uses from supplierAllows; the parse is broken and would pass vacuously`,
);

for (const [use, allowed] of Object.entries(serverTable)) {
  for (const status of STATUSES) {
    assert.equal(
      supplierAllows(status, use),
      allowed.includes(status),
      `supplierAllows("${status}", "${use}") disagrees with the server. A picker that offers ` +
        "fewer suppliers than the server accepts hides a permitted action; one that offers more " +
        "invites a refusal.",
    );
  }
}

// --- 2. An existing document never loses its supplier ------------------------

const qaFlour = { id: "s1", supplierName: "QA Flour Co", status: "inactive" };
assert.deepEqual(
  supplierOptionsFor([qaFlour], "new_document", "s1").map((s) => s.id),
  ["s1"],
  "opening a document whose supplier was since deactivated must still show that supplier",
);
assert.deepEqual(
  supplierOptionsFor([qaFlour], "new_document").map((s) => s.id),
  [],
);
assert.deepEqual(
  supplierOptionsFor([qaFlour], "payment").map((s) => s.id),
  ["s1"],
);

// --- 3. The list the pickers filter actually contains those suppliers --------

const api = read(resolve(rootDir, "src/lib/api/purchasing.ts"));
const lookupStart = api.indexOf("export async function lookupSuppliers(");
const lookup = api.slice(lookupStart, api.indexOf("\n}\n", lookupStart));
assert.match(
  lookup,
  /include_inactive:\s*"true"/,
  "purchasing lookupSuppliers must request inactive and blocked suppliers, or the payment picker " +
    "and every supplier filter drop them before the use table ever sees them (the bug that was measured)",
);
assert.match(lookup, /limit:\s*PURCHASING_SUPPLIER_LOOKUP_LIMIT/);

const frontendLimit = Number(/PURCHASING_SUPPLIER_LOOKUP_LIMIT = (\d+)/.exec(api)?.[1]);
const dto = read(resolve(repoRoot, "backend/internal/modules/suppliers/dto.go"));
const backendCap = Number(/supplierLookupMaxLimit = (\d+)/.exec(dto)?.[1]);
assert.ok(frontendLimit >= 100, "the purchasing supplier list must not stop at a small page");
assert.equal(
  frontendLimit,
  backendCap,
  "the purchasing lookup limit and the server's cap must match; a server cap below the request " +
    "silently truncates the list the browser searches",
);

// --- 4. Shape: no purchasing picker maps the raw list ------------------------

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const offenders = [];
for (const file of walk(resolve(rootDir, "src/components"))) {
  const source = read(file);
  if (!source.includes("PurchasingSupplierOption")) continue;
  if (/\bsuppliers\.map\(/.test(source) && !/supplierOptionsFor|supplierFilterLabel/.test(source)) {
    offenders.push(file.slice(rootDir.length + 1).replaceAll("\\", "/"));
  }
}
assert.deepEqual(
  offenders,
  [],
  "these components list purchasing suppliers without deciding which statuses belong there. " +
    "Use supplierOptionsFor(suppliers, use) for pickers or supplierFilterLabel for filters:\n  " +
    offenders.join("\n  "),
);

console.log("check-purchasing-supplier-use: pickers match the server's supplier status table.");
