/**
 * Marking a branch inactive is confirmed, and the confirmation says what stops.
 *
 * "Mark inactive" in the branch menu changed the status on one click. An
 * inactive branch cannot take checkout, and staff limited to it can no longer
 * work there. The server now also refuses the default and the last active
 * branch; the page must ask first for any other branch and name the effect.
 *
 * Regression: ISSUE-095 — a branch could be deactivated in one click, the default and last one included
 * Found by /investigate delete audit on 2026-09-18
 * Report: .gstack/qa-reports/delete-audit-2026-09-18.md
 *
 * Usage: node scripts/check-branch-deactivation-confirm.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const page = read("src/components/branches/branches-page-client.tsx");
const start = page.indexOf(
  "const handleStatusChange = async (branch: Branch, status: BranchStatus)",
);
assert.ok(start >= 0, "the branch status handler was not found");
const handler = page.slice(start, page.indexOf("\n  };\n", start));

const confirmAt = handler.search(
  /if \(status === "inactive"\) \{\s*const confirmed = await confirm\(\{/,
);
const writeAt = handler.indexOf("updateBranchStatusMutation.mutateAsync(");
assert.ok(confirmAt >= 0, "marking a branch inactive must be confirmed first");
assert.ok(writeAt > confirmAt, "the status is written only after the confirmation");
assert.match(
  handler,
  /if \(!confirmed\) \{\s*return;/,
  "declining the confirmation changes nothing",
);
assert.match(handler, /confirmLabel: "Mark inactive"/, "the button names the action");
assert.match(
  handler,
  /Checkout stops at \$\{branch\.name\}, and staff who can only work at this branch can no longer sell or record stock there/,
  "the confirmation says checkout and branch-limited staff stop working there",
);

console.log("check-branch-deactivation-confirm: marking a branch inactive is confirmed first.");
