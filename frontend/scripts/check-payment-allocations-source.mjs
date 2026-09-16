/**
 * "Held as supplier advance" must be read from the amounts, never from an empty list.
 *
 * GET /purchasing/supplier-payments returns rows WITHOUT allocations; only
 * GET /supplier-payments/:id carries them. The drawer rendered the list row and
 * treated the empty array as proof, so on production on 2026-09-16 the same
 * drawer said, about the same 540.00 payment that settled QAF-INV-1001:
 *
 *   Details tab        Used for bills AED 540.00   Supplier advance AED 0.00
 *   Bills settled tab  "No bills were settled by this payment.
 *                       The full amount is held as supplier advance."
 *
 * An operator chasing an unapplied advance would have been sent after money
 * that was already spent on a bill.
 *
 * Regression: ISSUE-030 — a bill payment's drawer called it an unapplied advance
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-payment-allocations-source.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

// --- 1. The claim is made from the amounts -----------------------------------

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const claims = [];
const offenders = [];
for (const file of walk(resolve(rootDir, "src/components"))) {
  const source = read(file);
  const index = source.indexOf("held as supplier advance");
  if (index === -1) continue;
  const relative = file
    .slice(rootDir.length + 1)
    .split("\\")
    .join("/");
  claims.push(relative);
  // The sentence must sit inside a branch on the allocated amount.
  const context = source.slice(Math.max(0, index - 600), index);
  if (!/allocatedAmount\s*>\s*0/.test(context)) {
    offenders.push(
      `${relative}: calls a payment an unapplied advance without checking allocatedAmount, so a ` +
        "payment whose allocations were simply not loaded is reported as unspent money",
    );
  }
}
assert.ok(
  claims.length >= 1,
  "the supplier advance empty state was not found; this check reads the wrong place",
);
assert.deepEqual(offenders, [], offenders.join("\n  "));

// --- 2. The drawer is given a payment that HAS its allocations ---------------

const page = read(
  resolve(rootDir, "src/components/purchasing/purchase-supplier-payments-page-client.tsx"),
);
assert.match(
  page,
  /useSupplierPayment\(\s*detailsPayment\?\.id \?\? null,/,
  "the payments drawer must fetch the payment by id; list rows carry no allocations",
);
assert.match(
  page,
  /payment=\{detailsPaymentQuery\.data \?\? detailsPayment\}/,
  "the drawer must be given the fetched payment when it has arrived",
);

console.log(
  "check-payment-allocations-source: the advance claim follows the amounts, not an empty list.",
);
