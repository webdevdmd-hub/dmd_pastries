/**
 * A role restricted to POS must see POS and nothing else.
 *
 * pos.view / pos.sell / pos.refund once stood in for orders, customers,
 * payments and returns in the navigation and in the page guards -- a stopgap
 * from before every tenant had those permissions seeded. The seeding happened
 * long ago; the stopgap did not leave, and a "POS only" role could open five
 * other modules. inventory.view did the same for suppliers and purchasing.
 *
 * The backend has the matching guard (cmd/api/permit_aliases_test.go). This
 * one holds the frontend side: outside the POS module, no navigation entry
 * and no page guard may accept a pos.* permission, and suppliers/purchasing
 * may not accept inventory.view.
 *
 * Usage: node scripts/check-permission-fallbacks.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const failures = [];

// --- navigation -----------------------------------------------------------
const nav = readFileSync(join(src, "components", "layout", "app-navigation.ts"), "utf8");
const entries = [
  ...nav.matchAll(
    /label: "([^"]+)",\s*(?:\/\/[^\n]*\n\s*)?(?:permission: ([^,\n]+)|permissionAny: \[([^\]]*)\])/g,
  ),
];
if (entries.length < 15) {
  failures.push(
    `navigation parse found only ${entries.length} entries -- the file shape changed, update this guard`,
  );
}
for (const [, label, single, many] of entries) {
  const perms = single ?? many ?? "";
  if (/PERMISSIONS\.pos(View|Sell|Refund|Checkout)/.test(perms) && label !== "POS Billing") {
    failures.push(`navigation entry "${label}" is unlocked by a pos.* permission`);
  }
  if (/PERMISSIONS\.inventoryView/.test(perms) && !["Inventory", "Manufacturing"].includes(label)) {
    failures.push(`navigation entry "${label}" is unlocked by inventory.view`);
  }
}

// --- page guards ----------------------------------------------------------
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
for (const file of walk(components)) {
  const rel = relative(components, file).replace(/\\/g, "/");
  // The dashboard router sends pos.* users to the cashier dashboard; both are
  // POS-facing by design, not a leak into another module.
  const posFacing = new Set([
    "dashboard/dashboard-router.tsx",
    "dashboard/cashier-dashboard-client.tsx",
  ]);
  if (rel.startsWith("pos/") || rel.startsWith("layout/") || posFacing.has(rel)) {
    continue;
  }
  const text = readFileSync(file, "utf8");
  if (/PERMISSIONS\.pos(View|Sell|Refund|Checkout)/.test(text)) {
    failures.push(`${rel} accepts a pos.* permission -- a POS-only role gets in`);
  }
  if (
    (rel.startsWith("suppliers/") || rel.startsWith("purchasing/")) &&
    /PERMISSIONS\.inventoryView/.test(text)
  ) {
    failures.push(`${rel} accepts inventory.view -- an inventory-only role gets in`);
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
  "  Permission fallbacks OK: pos.* unlocks POS only; inventory.view unlocks Inventory/Manufacturing only.",
);
