/**
 * The Audit Logs page shows changes, and views only when asked.
 *
 * ISSUE-060 (owner decision 2026-09-17): on production 48 of the newest 50
 * entries were "Jo viewed report summary" / "viewed dashboard admin", written
 * every minute by an open dashboard. The server now records a repeated view
 * once per 30 minutes and hides views unless include_views=true; this page
 * asks for them only when "Include views" is ticked.
 *
 * Also: empty lists in an entry's details read "Empty" ("Permissions Added:
 * Empty"), and generated permission descriptions said "Pos: cancel held sale".
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-audit-views.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const toolbar = read("src/components/admin/audit-logs-toolbar.tsx");
assert.match(toolbar, /includeViews: false,/, "views must be hidden by default");
assert.match(toolbar, /Include views/);

assert.match(
  read("src/lib/api/activity-logs.ts"),
  /if \(filters\.includeViews\) \{\s*params\.set\("include_views", "true"\);/,
);

const page = read("src/components/admin/audit-logs-page-client.tsx");
assert.match(page, /includeViews: filters\.includeViews,/);
assert.match(page, /String\(filters\.includeViews\)/, "toggling views must restart the cursor");

assert.doesNotMatch(read("src/components/admin/audit-log-entry.tsx"), /"Empty"/);
assert.match(read("src/components/roles/permission-module-card.tsx"), /pos: "POS"/);

console.log("check-audit-views: changes by default, views on request.");
