/**
 * A draft bill must be removable from every place bills are managed.
 *
 * The server refuses to cancel a draft ("draft purchase invoices should be
 * deleted, not cancelled"), and until now nothing could delete one. On
 * production on 2026-09-15 draft QA-DUE-TERMS-1 offered Edit and Post in the
 * Bills list and nothing else: a draft entered by mistake stayed forever, and a
 * draft converted from a purchase order blocked that order from being billed
 * again.
 *
 * Both the Bills list menu and the bill page must offer Delete draft, and only
 * for drafts: the server refuses to delete a posted bill.
 *
 * Regression: ISSUE-025 — a draft bill could never be removed
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-draft-bill-delete.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const api = read("src/lib/api/purchasing.ts");
assert.match(
  api,
  /export async function deletePurchaseInvoice\([^)]*\)[^{]*\{\s*await apiRequest<void>\(`\/api\/v1\/purchasing\/invoices\/\$\{id\}`,\s*\{\s*method: "DELETE"/,
  "deletePurchaseInvoice must call DELETE /api/v1/purchasing/invoices/:id",
);

// The list menu: a Delete draft item, shown only for drafts.
const menu = read("src/components/purchasing/purchase-invoice-actions-menu.tsx");
const draftBlock = /\{invoice\.status === "draft" \? \(([\s\S]*?)\) : null\}/.exec(menu)?.[1] ?? "";
assert.match(
  draftBlock,
  /onDelete\(invoice\)[\s\S]*Delete draft/,
  "the Bills list menu must offer Delete draft inside a draft-only branch",
);

const listPage = read("src/components/purchasing/purchase-invoices-page-client.tsx");
assert.match(
  listPage,
  /onDelete: \(invoice: PurchaseInvoice\) => void deleteDraft\(invoice\)/,
  "the Bills page must wire onDelete to a confirmed delete",
);
assert.match(listPage, /deleteMutation\.mutateAsync\(invoice\.id\)/);
assert.match(
  listPage,
  /const confirmed = await confirm\(/,
  "deleting is irreversible; the Bills page must confirm first",
);

// The bill page: same action, same draft-only rule.
const detailsPage = read("src/components/purchasing/purchase-invoice-details-page-client.tsx");
assert.match(
  detailsPage,
  /const canDeleteInvoice = \w+ && invoice\.status === "draft";/,
  "the bill page must offer Delete draft only for drafts",
);
assert.match(detailsPage, /\{canDeleteInvoice \? \([\s\S]*?Delete draft/);
assert.match(detailsPage, /const confirmed = await confirm\(/);

console.log(
  "check-draft-bill-delete: drafts can be deleted from the Bills list and the bill page.",
);
