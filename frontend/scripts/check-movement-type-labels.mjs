/**
 * A label chosen from a stock movement's TYPE must not name a source module
 * when that type is shared by several.
 *
 * sale_out is used by POS sales and by bakery orders on completion; return_in by
 * sales returns, POS voids and bakery order cancellations. The Movements summary
 * groups by type, so on production on 2026-09-15 it read "POS Sale - 5 - 5 moves"
 * while two of the five were bakery orders, and their rows said "Sold through
 * POS Receipt #ORD-000007" -- a receipt that does not exist.
 *
 * There are THREE frontend maps that label movement types, and they had already
 * drifted: both badges said "Sale Out" while the shared map said "POS Sale".
 * This checks every one of them, found by scanning rather than named, so a
 * fourth copy is covered the day it appears.
 *
 * Regression: ISSUE-019 — bakery order stock movements were labelled as POS sales
 * Found by /qa on 2026-09-15
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-movement-type-labels.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(rootDir, "src");

const SHARED_TYPES = ["sale_out", "return_in"];
const SOURCE_WORDS = ["POS", "Sales Return", "Bakery", "Purchase", "Manufacturing"];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

const maps = [];
const offenders = [];

for (const file of walk(srcDir)) {
  const source = readFileSync(file, "utf8");
  // A label map is any object literal that assigns a string to BOTH shared
  // types. Requiring both keeps unrelated objects out of the scan.
  if (!/\bsale_out\s*:\s*"/.test(source) || !/\breturn_in\s*:\s*"/.test(source)) {
    continue;
  }
  const relative = file
    .slice(rootDir.length + 1)
    .split("\\")
    .join("/");
  maps.push(relative);
  for (const type of SHARED_TYPES) {
    const match = new RegExp(`\\b${type}\\s*:\\s*"([^"]*)"`).exec(source);
    if (!match) {
      continue;
    }
    const label = match[1];
    const named = SOURCE_WORDS.find((word) => label.includes(word));
    if (named) {
      offenders.push(`${relative}: ${type} is labelled "${label}", which names ${named}`);
    }
  }
}

// Vacuity guard: if the scan finds nothing, the check would pass while checking
// nothing. Three maps exist today.
assert.ok(
  maps.length >= 3,
  `expected at least the three known movement label maps, found ${String(maps.length)}: ${maps.join(", ")}`,
);

assert.deepEqual(
  offenders,
  [],
  "a movement type shared by several modules is labelled with one module's name. The " +
    "Movements summary groups every movement of that type under this label, so it " +
    `misattributes the rest:\n  ${offenders.join("\n  ")}`,
);

console.log(
  `check-movement-type-labels: ${String(maps.length)} label maps, no shared type names a single source.`,
);
