/**
 * Deleting a customer with history is refused, and the page says so.
 *
 * The server used to soft-delete any customer, which broke the bakery orders,
 * expenses and store credit that still pointed at them. It now answers 409
 * with a message naming what the customer has. The page must show that
 * message, offer the way out it names (deactivate), and never promise a delete
 * the server will refuse. It also used a generic "Confirm" button and the
 * phrase "soft-deletes".
 *
 * Regression: ISSUE-087 — a customer with orders could be deleted, breaking the orders
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-customer-delete-history.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/customers/customers-page-client.tsx");

const start = page.indexOf("const deleteCustomer = async (customer: Customer)");
assert.ok(start >= 0, "the customers page has no deleteCustomer flow");
const flow = page.slice(start, page.indexOf("\n  };\n", start));

assert.match(
  flow,
  /await confirm\(\{[\s\S]*?confirmLabel: "Delete customer"[\s\S]*?\}\);\s*if \(!confirmed\)/,
  "a delete is confirmed first, with a button that names the action",
);
assert.match(
  flow,
  /orders, sales, expenses, store credit or an opening balance cannot be deleted/,
  "the confirmation says which customers cannot be deleted",
);
assert.match(
  flow,
  /error instanceof ApiError && error\.status === 409/,
  "the 409 refusal is handled, not only toasted",
);
assert.match(
  flow,
  /consequence: error\.message/,
  "the refusal shows the server's message, which names what the customer has",
);
assert.match(
  flow,
  /confirmLabel: "Deactivate customer"[\s\S]*?payload: \{ status: "inactive" \}/,
  "the refusal offers to deactivate the customer instead",
);
assert.match(
  page,
  /onDelete: \(customer: Customer\) => \{\s*void deleteCustomer\(customer\);/,
  "the list's Delete runs the checked flow",
);
assert.doesNotMatch(page, /soft-deletes/, "the jargon delete copy is back");

console.log(
  "check-customer-delete-history: the customer delete flow surfaces the history refusal.",
);
