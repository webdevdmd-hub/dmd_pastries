/**
 * Cancel bill must be greyed, with the server's reason, when the server will refuse it.
 *
 * On production on 2026-09-15, paid bill QAF-INV-1001 showed Edit greyed with
 * "This bill has supplier payments against it, so it cannot be edited." and
 * Cancel bill enabled. The cancel dialog took a reason, then the server refused.
 * Both places that offer Cancel bill must read the backend's can_cancel.
 *
 * Regression: ISSUE-027 — Cancel bill was offered on bills the server always refuses to cancel
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-bill-cancel-gate.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const api = read("src/lib/api/purchasing.ts");
const parsed = api.match(/canCancel: typeof value\.can_cancel === "boolean"/g) ?? [];
assert.equal(
  parsed.length,
  (api.match(/canEdit: typeof value\.can_edit === "boolean"/g) ?? []).length,
  "every bill parser that reads can_edit must also read can_cancel",
);

function cancelItem(source, file) {
  const index = source.indexOf("Cancel bill\n");
  assert.ok(index !== -1, `${file} offers no Cancel bill item`);
  const open = source.lastIndexOf("<DropdownMenuItem", index);
  return source.slice(open, index);
}

for (const file of [
  "src/components/purchasing/purchase-invoice-actions-menu.tsx",
  "src/components/purchasing/purchase-invoice-details-page-client.tsx",
]) {
  const item = cancelItem(read(file), file);
  assert.match(
    item,
    /disabled=\{!invoice\.canCancel\}/,
    `${file}: Cancel bill must be disabled when the server says the bill cannot be cancelled`,
  );
  assert.match(
    item,
    /title=\{invoice\.canCancel \? undefined : invoice\.cancelBlockedReason\}/,
    `${file}: a greyed Cancel bill must say why`,
  );
}

console.log(
  "check-bill-cancel-gate: Cancel bill follows the server's can_cancel, with its reason.",
);
