/**
 * No developer stub may ship as user-facing guidance.
 *
 * The Payments page's only write action asked for a "Sale ID" behind the
 * placeholder `sale_uuid_here`. A sale's UUID appears nowhere in the app -- the
 * screens show SALE-20260914-000001 -- so the field could not be filled in by
 * the person the page is for, and the placeholder told them to type a database
 * identifier. It is now a picker of the sales that actually owe money.
 *
 * A placeholder is the one piece of copy written while the field is still a
 * sketch, and the sketch is easy to forget. This catches the leftovers by their
 * shape: snake_case tokens, "uuid"/"id_here" spellings, lorem, TODO/FIXME, and
 * the classic `xxx` / `foo` / `bar` stand-ins.
 *
 * Regression: ISSUE-015 — Record payment demanded a sale UUID no operator can see
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-no-stub-placeholders.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(rootDir, "src");

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

// Each rule gets a reason, so a failure explains itself rather than pointing at
// a regex. `sku_snapshot`-style prop names are not placeholders, so the checks
// only read the STRING a user actually sees.
const stubPatterns = [
  { label: "a snake_case token", test: (text) => /^[a-z0-9]+(_[a-z0-9]+){1,}$/.test(text) },
  {
    label: "a UUID or id stand-in",
    test: (text) => /\b(uuid|id_here|your_id|some_id)\b/i.test(text),
  },
  { label: "lorem ipsum", test: (text) => /lorem\s+ipsum/i.test(text) },
  { label: "a TODO or FIXME", test: (text) => /\b(todo|fixme|tbd|xxx)\b/i.test(text) },
  { label: "a foo/bar stand-in", test: (text) => /\b(foo|bar|baz|qux)\b/i.test(text) },
];

// Known offenders, each owned by the module audit that will reach it.
//
// This is a ratchet, not an amnesty. Every entry is the SAME defect as
// ISSUE-015 -- a field asking the operator for a database identifier they
// cannot see -- and each needs the same fix, a picker. They are listed rather
// than silently skipped so the count can only go down, and anything NEW fails
// immediately.
//
// Filter bars (Reports): four optional filters that cannot be used without
// reading the database. Lookup hooks already exist in @/hooks/use-lookups.
// Master data / settings: two snake_case stubs shown as example values.
const KNOWN_STUBS = new Set([
  "src/components/master-data/master-data-page-client.tsx: Optional parent category UUID",
  "src/components/master-data/master-data-page-client.tsx: in_production",
  "src/components/reports/bakery-orders/bakery-orders-report-filter-bar.tsx: Optional customer UUID",
  "src/components/reports/financial/financial-report-filter-bar.tsx: Optional payment method UUID",
  "src/components/reports/manufacturing/manufacturing-report-filter-bar.tsx: Optional product UUID",
  "src/components/reports/manufacturing/manufacturing-report-filter-bar.tsx: Optional recipe UUID",
  "src/components/settings/sales-channels-page-client.tsx: delivery_platform",
]);

const offenders = [];
const stillKnown = new Set();
for (const file of walk(srcDir)) {
  const source = readFileSync(file, "utf8");
  // placeholder="..." and placeholder={"..."} only; a bare {expression} is
  // computed at runtime and cannot be judged here.
  for (const match of source.matchAll(/placeholder=(?:"([^"]*)"|\{"([^"]*)"\})/g)) {
    const text = (match[1] ?? match[2] ?? "").trim();
    if (!text) {
      continue;
    }
    for (const pattern of stubPatterns) {
      if (pattern.test(text)) {
        const relative = file
          .slice(rootDir.length + 1)
          .split("\\")
          .join("/");
        const key = `${relative}: ${text}`;
        if (KNOWN_STUBS.has(key)) {
          stillKnown.add(key);
          break;
        }
        offenders.push(`${relative}: "${text}" looks like ${pattern.label}`);
        break;
      }
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  "these placeholders read as developer stubs rather than guidance for the person filling " +
    `the field in:\n  ${offenders.join("\n  ")}`,
);

// The ratchet only tightens if fixed entries are removed from the list.
const fixed = [...KNOWN_STUBS].filter((entry) => !stillKnown.has(entry));
assert.deepEqual(
  fixed,
  [],
  "these placeholders are fixed but still listed as known offenders. Delete them from " +
    `KNOWN_STUBS so the list can only shrink: ${fixed.join(", ")}`,
);

console.log(
  `check-no-stub-placeholders: no new stub placeholders (${String(KNOWN_STUBS.size)} known, awaiting their module audits).`,
);
