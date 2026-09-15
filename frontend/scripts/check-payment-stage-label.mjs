/**
 * Every Payments view must label a payment stage the same way.
 *
 * A POS sale settles in one go at the counter and has no deposit/balance/final
 * stage, so `orderPaymentTypeLabel` falling through to "Not set" reads as a
 * data gap on every counter sale rather than "this concept does not apply".
 *
 * That was fixed once, INLINE inside payments-table. The card grid and the
 * details drawer kept calling `orderPaymentTypeLabel` directly, so the bug
 * stayed live in the card grid -- which is the view the Payments page renders
 * by default. Measured on production on 2026-09-15:
 *
 *   SALE-20260914-000001  POS Sale · Walk-in customer  Cash  "Not Set"  AED 351.00
 *
 * ("Not Set" rather than "Not set" because the card applies `capitalize`.)
 *
 * This is the third time in this audit that a fix landed on one call site while
 * the same bug stayed live in another: ISSUE-006 patched the wrong module, and
 * ISSUE-013 took three commits across three queries. So this check does not
 * name a call site. It asserts the SHAPE: no Payments view may call the raw
 * order-stage label, because that function cannot know a sale has no stage.
 *
 * Regression: ISSUE-014 — "Not set" stage on counter sales, in the views the first fix missed
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-payment-stage-label.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paymentsDir = resolve(rootDir, "src/components/payments");

// --- The shared rule must exist and must distinguish the two sources --------

const helper = readFileSync(resolve(rootDir, "src/lib/orders/payment-stage.ts"), "utf8");

assert.ok(
  helper.includes("export function paymentStageLabel("),
  "paymentStageLabel must exist: the rule has to live in one place, because keeping it " +
    "inline in a single view is exactly what let the other two views stay wrong",
);

assert.ok(
  /sourceType === "bakery_order"/.test(helper),
  "paymentStageLabel must branch on the source: a bakery order genuinely should carry a " +
    "stage, so a missing one there IS worth showing, while a sale payment never has one",
);

assert.ok(
  !/return "Not set";\s*}\s*$/.test(
    helper.slice(helper.indexOf("export function paymentStageLabel(")),
  ),
  'paymentStageLabel must not fall through to "Not set" for every payment',
);

// --- No Payments view may reach past it ------------------------------------

const offenders = [];
for (const entry of readdirSync(paymentsDir)) {
  if (!entry.endsWith(".tsx")) {
    continue;
  }
  const source = readFileSync(join(paymentsDir, entry), "utf8");
  // Strip comments: the fix is documented by name in several of these files.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/orderPaymentTypeLabel\s*\(/.test(code)) {
    offenders.push(entry);
  }
}

assert.deepEqual(
  offenders,
  [],
  `these Payments views call orderPaymentTypeLabel directly: ${offenders.join(", ")}. ` +
    "That function takes only the payment type, so it cannot tell a counter sale (no stage) " +
    'from a bakery order missing one, and renders "Not set" for both. Use paymentStageLabel',
);

// --- And the label a sale gets must not read as missing data ---------------

const saleLabel = /return sourceType === "bakery_order" \? "Not set" : "([^"]+)"/.exec(helper);
assert.ok(saleLabel, "expected paymentStageLabel to name what a sale payment is called");
assert.notEqual(
  saleLabel[1].toLowerCase(),
  "not set",
  "a counter sale must not be labelled as though its stage were missing",
);

console.log("check-payment-stage-label: every Payments view labels a stage the same way.");
