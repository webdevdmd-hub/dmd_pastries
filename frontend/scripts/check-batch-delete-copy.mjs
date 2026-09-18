/**
 * Deleting a planned batch says what happens to the bakery order behind it.
 *
 * Deleting a batch now unlinks the bakery orders it was made for and moves an
 * order that was in production only because of it back to confirmed; before,
 * the order stayed linked to a deleted batch and stuck "in production". The
 * server also only deletes draft and planned batches now, which is what the
 * screens offer: Delete stays behind the planned-status check.
 *
 * Regression: ISSUE-090 — batch delete left the bakery order linked and in production
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-batch-delete-copy.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/manufacturing/batches-page-client.tsx");
const dialog = page.slice(page.indexOf("<DialogTitle>Delete planned production?</DialogTitle>"));
assert.ok(dialog.length > 0, "the planned production delete dialog was not found");
const description = /<DialogDescription>([\s\S]*?)<\/DialogDescription>/.exec(dialog)?.[1] ?? "";
const copy = description.replace(/\s+/g, " ").trim();

assert.match(
  copy,
  /A bakery order it was made for is unlinked, and goes back to confirmed if this was its only production\./,
  "the delete dialog must say what happens to the bakery order behind the batch",
);

// The server refuses anything but a draft or planned batch; the screens must
// keep offering Delete only there.
const menu = read("src/components/manufacturing/batch-actions-menu.tsx");
assert.match(
  menu,
  /const showDelete = canDelete && isPlanned;/,
  "the row menu gates Delete on planned",
);
const drawer = read("src/components/manufacturing/batch-details-drawer.tsx");
assert.match(drawer, /\{canDelete && isPlanned \? \(/, "the drawer gates Delete on planned");
assert.match(
  read("src/lib/manufacturing/batch-status.ts"),
  /return status === "draft" \|\| status === "planned";/,
  "planned means draft or planned, as the server allows",
);

console.log("check-batch-delete-copy: batch delete copy and gates match the server.");
