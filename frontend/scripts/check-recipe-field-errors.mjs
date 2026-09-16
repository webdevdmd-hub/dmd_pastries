/**
 * Every field the recipe save toast can name must also show its own error.
 *
 * On production on 2026-09-16 an empty save toasted "Complete required recipe
 * fields: Product, Recipe name, Yield unit." Product and Recipe name showed an
 * inline message; Yield unit showed nothing, further down a scrolled dialog.
 * Yield quantity had the same gap. This reads the toast's field list and holds
 * the form to it, so a field added to the toast cannot ship without its message.
 *
 * Regression: ISSUE-041 — Yield unit was named in the save toast but never marked on the form
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-recipe-field-errors.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  resolve(rootDir, "src/components/recipes/recipe-form-page.tsx"),
  "utf8",
).replaceAll("\r\n", "\n");

const toastStart = source.indexOf("const showValidationToast");
assert.ok(toastStart !== -1, "showValidationToast not found");
const toast = source.slice(toastStart, source.indexOf("toast.error(", toastStart));
const named = [...toast.matchAll(/errors\.(\w+) \?/g)].map((match) => match[1]);
assert.ok(
  named.length >= 5,
  `parsed ${String(named.length)} fields from the toast; the parse is broken`,
);

const missing = named.filter((field) => !source.includes(`fieldError("${field}")`));
assert.deepEqual(
  missing,
  [],
  "the save toast names these fields but the form never shows their error, so the operator is told " +
    `something is missing without being shown where: ${missing.join(", ")}`,
);

console.log(
  `check-recipe-field-errors: all ${String(named.length)} toast fields show an inline error.`,
);
