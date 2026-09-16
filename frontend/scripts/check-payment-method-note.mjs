/**
 * A payment method's type is shown only when it differs from its name.
 *
 * Methods carry an operator-chosen name and a system type. Payments Made
 * printed both, so on production on 2026-09-16 every row of the Method column
 * read "Cash" with "cash" under it, and the payment drawer read "Cash · cash".
 *
 * Two surfaces printed it; the rule lives in one place, and this checks that
 * nothing renders the raw type beside the name again.
 *
 * Regression: ISSUE-029 — Payments Made printed the method name and its type twice over
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-payment-method-note.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");

const transpiled = ts.transpileModule(
  read(resolve(rootDir, "src/lib/purchasing/payment-method-label.ts")),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
);
const moduleState = { exports: {} };
new Function("exports", "module", transpiled.outputText)(moduleState.exports, moduleState);
const { paymentMethodTypeNote } = moduleState.exports;

assert.equal(paymentMethodTypeNote("Cash", "cash"), null, "the measured case: Cash / cash");
assert.equal(
  paymentMethodTypeNote("Bank Transfer", "bank_transfer"),
  null,
  "underscores are not a difference",
);
assert.equal(paymentMethodTypeNote("Cash", ""), null, "no type, nothing to add");
assert.equal(
  paymentMethodTypeNote("Etisalat card terminal", "card"),
  "card",
  "a type that says something the name does not must still show",
);

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const offenders = [];
for (const file of walk(resolve(rootDir, "src/components/purchasing"))) {
  const source = read(file);
  if (/paymentMethodType\.replace/.test(source)) {
    offenders.push(
      file
        .slice(rootDir.length + 1)
        .split("\\")
        .join("/"),
    );
  }
}
assert.deepEqual(
  offenders,
  [],
  "these render the raw method type beside the method name, which repeats the name whenever the " +
    `two match. Use paymentMethodTypeNote:\n  ${offenders.join("\n  ")}`,
);

console.log("check-payment-method-note: the method type is shown only when it adds something.");
