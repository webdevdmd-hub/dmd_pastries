/**
 * The dashboard's activity feed is the audit trail, so it loads and shows
 * only for audit_logs.view.
 *
 * Regression: ISSUE-067. Every dashboard loaded /dashboard/recent-activity for
 * anyone with dashboard.view. On production on 2026-09-18 a till-only role
 * read staff logins, users created and deleted, and role changes on the
 * Cashier dashboard while /audit-logs denied it. The server now refuses the
 * feed without the permission; this keeps the dashboards from asking for it,
 * including through Refresh, since React Query's refetch() ignores `enabled`.
 *
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
 *
 * Usage: node scripts/check-dashboard-activity-gate.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const rail = read("src/components/dashboard/dashboard-insight-rail.tsx");
assert.match(rail, /hasPermission\(PERMISSIONS\.auditLogsView\)/, "rail checks audit_logs.view");
assert.match(
  rail,
  /useRecentActivity\(canLoad && canViewActivity\)/,
  "rail loads the feed only with the permission",
);
assert.match(
  rail,
  /\{canViewActivity \? \(\s*<DashboardRecentActivity/,
  "rail shows the feed only with the permission",
);

const admin = read("src/components/dashboard/admin-dashboard-client.tsx");
assert.match(admin, /hasPermission\(PERMISSIONS\.auditLogsView\)/, "admin checks audit_logs.view");
assert.match(
  admin,
  /useRecentActivity\(canLoadDashboard && canViewActivity\)/,
  "admin dashboard loads the feed only with the permission",
);
assert.match(
  admin,
  /canViewActivity \? activityQuery\.refetch\(\) : undefined/,
  "Refresh does not refetch the feed without the permission",
);
assert.doesNotMatch(
  admin,
  /^\s+activityQuery\.refetch\(\),$/m,
  "no unguarded feed refetch remains",
);
assert.match(
  admin,
  /\{canViewActivity \? \(\s*<ActivityTable/,
  "admin dashboard shows the activity table only with the permission",
);

console.log("dashboard activity gate: ok");
