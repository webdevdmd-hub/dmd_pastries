/**
 * Error toasts must not end in codes, statuses or ids.
 *
 * The backend's error detail map mixes prose for people with metadata for code.
 * The API client appended every string value to the message, so on production:
 *
 *   "...Deactivate it instead.: supplier_has_history"               (PR #19)
 *   "this supplier is inactive; reactivate it ...: inactive"        (2026-09-15)
 *
 * PR #20 fixed the first at one call site. 32 backend refusals carry a `reason`
 * code and 56 a `status`, and some carry record ids, so every one of them could
 * leak. This checks the rule once, where the message is built.
 *
 * Regression: ISSUE-026 — error toasts ended in reason codes and statuses
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-error-message-details.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(rootDir, path), "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(read("src/lib/api/error-message.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { joinErrorMessage } = moduleState.exports;

const cases = [
  [
    "a status code is dropped (the toast measured live)",
    "This supplier is inactive. Reactivate it to start a new order, bill or advance payment.",
    ["inactive"],
    "This supplier is inactive. Reactivate it to start a new order, bill or advance payment.",
  ],
  [
    "a reason code is dropped, with no stray '.:'",
    "This supplier has purchasing history, so it cannot be deleted. Deactivate it instead.",
    ["supplier_has_history"],
    "This supplier has purchasing history, so it cannot be deleted. Deactivate it instead.",
  ],
  [
    "a record id is dropped",
    "journal entry is already reversed",
    ["3f6c1e2a-9b1d-4c7e-8f00-1a2b3c4d5e6f"],
    "journal entry is already reversed",
  ],
  [
    "prose detail is kept",
    "invalid request payload",
    ["json: cannot unmarshal string into Go struct field .amount of type float64"],
    "invalid request payload: json: cannot unmarshal string into Go struct field .amount of type float64",
  ],
  [
    "prose after a finished sentence joins with a space",
    "Allocation refused.",
    ["Allocation amount cannot exceed the bill balance"],
    "Allocation refused. Allocation amount cannot exceed the bill balance",
  ],
  [
    "a detail repeating the message is not doubled",
    "supplier not found",
    ["supplier not found"],
    "supplier not found",
  ],
];
for (const [name, message, details, expected] of cases) {
  assert.equal(joinErrorMessage(message, details), expected, name);
}

// The client must build failure messages through the rule, not beside it.
const client = read("src/lib/api/client.ts");
assert.match(
  client,
  /joinErrorMessage\(\s*message,/,
  "client.ts must build failure messages with joinErrorMessage",
);
assert.doesNotMatch(
  client,
  /`\$\{message\}: \$\{/,
  "client.ts appends detail to the message directly again; codes and ids will leak into toasts",
);

console.log("check-error-message-details: codes, statuses and ids stay out of error messages.");
