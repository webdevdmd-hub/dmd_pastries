/**
 * Receipt layout Preview sends the JSON body the server binds.
 *
 * ISSUE-062, found in the Settings audit on 2026-09-17: previewReceiptLayout
 * posted with no body and PreviewReceiptLayout required one, so every Preview
 * failed with "invalid request payload" (EOF) -- the same contract break that
 * stopped journal reversals (ISSUE-047).
 *
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-receipt-preview.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const api = readFileSync(resolve(rootDir, "src/lib/api/settings-data.ts"), "utf8").replaceAll(
  "\r\n",
  "\n",
);
const start = api.indexOf("export async function previewReceiptLayout");
assert.notEqual(start, -1);
assert.match(
  api.slice(start, api.indexOf("\n}\n", start)),
  /body: \{\}/,
  "previewReceiptLayout must send a JSON body",
);

console.log("check-receipt-preview: Preview sends a body.");
