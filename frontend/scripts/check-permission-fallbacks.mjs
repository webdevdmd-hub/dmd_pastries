/**
 * A permission box means exactly itself.
 *
 * pos.view once stood in for orders, customers, payments and returns;
 * inventory.view for suppliers, purchasing and manufacturing; products.view
 * for recipes; settings.view for branches; and so on -- stopgaps from before
 * every tenant had those permissions seeded. The seeding happened; the
 * stopgaps stayed, and the Roles screen's 170 boxes stopped meaning what they
 * say. Four places also decided access by whether a role's *name* contained
 * "owner", "admin" or "manager".
 *
 * The backend has the matching guard (cmd/api/permit_aliases_test.go). This
 * one holds the frontend:
 *  1. every navigation entry is unlocked only by its own module's permissions;
 *  2. every page-level view guard (`const canView = hasAnyPermission([...])`)
 *     under components/<module>/ names only that module's permissions;
 *  3. nothing decides access from a role's name.
 *
 * Usage: node scripts/check-permission-fallbacks.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const failures = [];

// PERMISSIONS key -> "module.action" string, from the constants file.
const permSource = readFileSync(join(src, "constants", "permissions.ts"), "utf8");
const keyToString = new Map();
for (const m of permSource.matchAll(/(\w+):\s*"([a-z_]+(?:\.[a-z_]+)+)"/g)) {
  keyToString.set(m[1], m[2]);
}
const moduleOf = (key) => (keyToString.get(key) ?? "").split(".")[0];

// --- 1. navigation -----------------------------------------------------------
// Which permission modules may unlock which entry. Most entries are one
// module; the combined ones are listed. Anything else is a fallback.
const navModules = {
  "Payment Setup": ["settings"],
  "Settings & Master Data": ["settings", "master_data"],
  "POS Billing": ["pos"],
};
const nav = readFileSync(join(src, "components", "layout", "app-navigation.ts"), "utf8");
const entries = [
  ...nav.matchAll(/label: "([^"]+)",\s*(?:permission: ([^,\n]+)|permissionAny: \[([^\]]*)\])/g),
];
if (entries.length < 15) {
  failures.push(
    `navigation parse found only ${entries.length} entries -- the file shape changed, update this guard`,
  );
}
for (const [, label, single, many] of entries) {
  const keys = [...(single ?? many ?? "").matchAll(/PERMISSIONS\.(\w+)/g)].map((m) => m[1]);
  const modules = new Set(keys.map(moduleOf));
  const allowed = navModules[label] ?? [...modules].slice(0, 1);
  for (const mod of modules) {
    if (!allowed.includes(mod)) {
      failures.push(`navigation entry "${label}" is unlocked by a ${mod}.* permission`);
    }
  }
}

// --- 2. page guards ----------------------------------------------------------
// components/<dir> -> permission modules that may appear in its canView guard.
const dirModules = {
  "audit-logs": ["audit_logs"],
  accounting: ["accounting"],
  branches: ["branches"],
  customers: ["customers"],
  expenses: ["expenses"],
  ingredients: ["ingredients"],
  inventory: ["inventory", "stock_movements"],
  manufacturing: ["manufacturing"],
  orders: ["orders"],
  packaging: ["packaging"],
  payments: ["payments", "sales_returns"],
  products: ["products"],
  purchasing: ["purchasing", "expenses"], // the expenses pages live here
  recipes: ["recipes"],
  reports: ["reports"],
  roles: ["roles"],
  settings: ["settings", "master_data"],
  "stock-movements": ["stock_movements", "inventory"],
  suppliers: ["suppliers"],
  users: ["users"],
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const components = join(src, "components");
const roleNameCheck = /roleName\s*\.\s*includes\(|role\.toLowerCase\(\)\.includes\(|hasRole\(/;

for (const file of walk(components)) {
  const rel = relative(components, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");

  if (roleNameCheck.test(text)) {
    failures.push(
      `${rel} decides access from a role's name -- roles are labels, permissions are the contract`,
    );
  }

  const dir = rel.split("/")[0];
  const allowed = dirModules[dir];
  if (!allowed) {
    continue;
  }
  for (const m of text.matchAll(/const canView\s*=\s*hasAnyPermission\(\[([^\]]*)\]\)/g)) {
    const keys = [...m[1].matchAll(/PERMISSIONS\.(\w+)/g)].map((x) => x[1]);
    for (const key of keys) {
      const mod = moduleOf(key);
      if (mod && !allowed.includes(mod)) {
        failures.push(
          `${rel}: canView accepts ${keyToString.get(key)} -- a ${mod}-only role gets in`,
        );
      }
    }
  }
}

// --- 3. forms use the lookup tier, not other modules' list endpoints -------------
// A form that may write a record must be able to name what the record refers
// to, without holding the other module's view permission. The list hooks
// below require that permission; forms outside their module must use
// useLookups / useProductPicker (hooks/use-lookups.ts) instead. Module pages
// and filters keep using the list hooks -- they are the module.
const listHooks = {
  "useProducts(": "products",
  "useSuppliers(": "suppliers",
  "useBranches(": "branches",
  "useSalesChannels(": "settings",
  "useUnits(": "master-data",
  "useProductCategories(": "master-data",
  "useTaxRates(": "settings",
};
for (const file of walk(components)) {
  const rel = relative(components, file).replace(/\\/g, "/");
  const dir = rel.split("/")[0];
  if (!/(form|dialog|editor|drawer)[^/]*\.tsx$/.test(rel)) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const [hook, owner] of Object.entries(listHooks)) {
    if (text.includes(hook) && dir !== owner) {
      failures.push(
        `${rel} calls ${hook}) -- a form outside ${owner} must use the lookup tier (hooks/use-lookups.ts)`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Permission fallback guard failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  "  Permission fallbacks OK: every entry and page guard is unlocked by its own module only; no role-name checks.",
);
