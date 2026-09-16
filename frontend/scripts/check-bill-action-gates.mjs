/**
 * Every surface that offers Edit bill or Cancel bill must obey the server's gate.
 *
 * The backend sends can_edit / edit_blocked_reason and can_cancel /
 * cancel_blocked_reason with every bill, because both actions are refused on a
 * bill that has been paid, credited or received against.
 *
 * Measured on production, paid bill QAF-INV-1001:
 *
 *   Bills list menu   Edit greyed with its reason; Cancel bill enabled -> 409
 *   Bill page menu    Edit bill enabled -> form opened, save returned 409
 *                     "posted bill has supplier payments and cannot be edited"
 *   Bill drawer       Edit bill enabled, same
 *
 * Each fix so far landed on ONE surface while the others kept offering the
 * action. So this does not name components: it scans for the labels and holds
 * every one of them to the gate, which covers a fourth surface the day it
 * appears.
 *
 * Regression: ISSUE-027 — Cancel bill was offered on bills the server always refuses to cancel
 * Regression: ISSUE-028 — Edit bill was offered on the bill page and drawer after the list gated it
 * Found by /qa on 2026-09-15 and 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-bill-action-gates.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

// --- The gate reaches the client at all --------------------------------------

const api = read(resolve(rootDir, "src/lib/api/purchasing.ts"));
for (const field of ["can_edit", "can_cancel"]) {
  const parsed = (api.match(new RegExp(`value\\.${field} === "boolean"`, "g")) ?? []).length;
  assert.ok(parsed >= 2, `every bill parser must read ${field}; found ${String(parsed)}`);
}

// --- Every surface offering the action obeys it ------------------------------

const ACTIONS = [
  { label: "Edit bill", flag: "canEdit", reason: "editBlockedReason" },
  { label: "Cancel bill", flag: "canCancel", reason: "cancelBlockedReason" },
];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const found = [];
const offenders = [];

for (const file of walk(resolve(rootDir, "src/components/purchasing"))) {
  const source = read(file);
  const relative = file
    .slice(rootDir.length + 1)
    .split("\\")
    .join("/");
  for (const action of ACTIONS) {
    // The label as rendered text, not as a dialog title or a toast.
    const rendered = new RegExp(
      `\\n\\s*${action.label}\\s*\\n\\s*</(Button|DropdownMenuItem)>`,
    ).exec(source);
    if (!rendered) continue;
    found.push(`${relative}: ${action.label}`);
    // Back up to the control's own opening tag, past any icon nested inside it.
    const opening = Math.max(
      source.lastIndexOf("<Button", rendered.index),
      source.lastIndexOf("<DropdownMenuItem", rendered.index),
    );
    const element = source.slice(opening, rendered.index + rendered[0].length);
    if (!element.includes(`disabled={!invoice.${action.flag}}`)) {
      offenders.push(
        `${relative}: ${action.label} ignores invoice.${action.flag}, so it is offered on a bill the server refuses`,
      );
      continue;
    }
    if (!element.includes(`invoice.${action.reason}`)) {
      offenders.push(
        `${relative}: ${action.label} is greyed without showing invoice.${action.reason}`,
      );
    }
  }
}

// Vacuity guard: three surfaces offer these today (list menu, bill page, drawer).
assert.ok(
  found.length >= 4,
  `expected at least four bill action buttons across the surfaces, found ${String(found.length)}: ${found.join(", ")}`,
);

assert.deepEqual(
  offenders,
  [],
  "a bill action is offered without the server's gate. The action opens, takes input, and then " +
    `fails:\n  ${offenders.join("\n  ")}`,
);

// The Bills list menu labels its item "Edit", not "Edit bill", so the scan above
// does not see it. It is where the gate first shipped; keep it.
const listMenu = read(
  resolve(rootDir, "src/components/purchasing/purchase-invoice-actions-menu.tsx"),
);
assert.match(
  listMenu,
  /disabled=\{!invoice\.canEdit\}[\s\S]{0,200}invoice\.editBlockedReason/,
  "the Bills list Edit item must stay gated on invoice.canEdit with its reason",
);

console.log(
  `check-bill-action-gates: ${String(found.length + 1)} bill actions, all gated on the server's flags.`,
);
