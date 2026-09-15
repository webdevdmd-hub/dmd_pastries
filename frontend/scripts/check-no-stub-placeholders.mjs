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
// The snake_case rule that used to sit here was wrong, and it took two false
// positives to see it. "Status key" and "Channel type" are fields whose VALUE
// is a machine key the operator types, so `in_production` and
// `delivery_platform` are correct examples of the expected format, not stubs.
// Churning that copy to satisfy a bad rule would have made the app worse.
//
// What actually marks a stub is asking for an identifier the user cannot see,
// or leaving a note to yourself in the box. "uuid" is matched as a SUBSTRING
// rather than a word, because the original offender was `sale_uuid_here` and
// `_` is a word character, so uuid never fires inside it.
const stubPatterns = [
  { label: "a request for a UUID", test: (text) => /uuid/i.test(text) },
  { label: "an id stand-in", test: (text) => /\b(id_here|your_id|some_id)\b/i.test(text) },
  { label: "a _here suffix", test: (text) => /_here\b/i.test(text) },
  { label: "lorem ipsum", test: (text) => /lorem\s+ipsum/i.test(text) },
  { label: "a TODO or FIXME", test: (text) => /\b(todo|fixme|tbd|xxx)\b/i.test(text) },
  { label: "a foo/bar stand-in", test: (text) => /\b(foo|bar|baz|qux)\b/i.test(text) },
];

// Empty, and it should stay that way.
//
// This started with seven entries: five fields asking for a UUID, and two that
// turned out to be the rule's fault rather than the app's. All five are now
// pickers. An entry here is a promise to come back, not permission to ship.
const KNOWN_STUBS = new Set([]);

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
  KNOWN_STUBS.size === 0
    ? "check-no-stub-placeholders: no stub placeholders in src."
    : `check-no-stub-placeholders: no new stub placeholders (${String(KNOWN_STUBS.size)} still known).`,
);
