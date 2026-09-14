/**
 * No font weight above 600 in app code.
 *
 * DESIGN.md makes this a non-negotiable: 500 is the workhorse, 600 the
 * ceiling. The base-layer reset in globals.css already pins the UA defaults
 * (strong, b, th), but a Tailwind utility beats an element reset, so every
 * `font-bold` (700) in a className rendered heavier than the system allows.
 * The 2026-09-14 production QA run measured 700 on the trial balance, P&L and
 * balance sheet headings, on dashboard KPI numbers, and on the POS search
 * shortcut hint; 89 occurrences were replaced with font-semibold in one pass.
 *
 * Regression: ISSUE-009 — weight-700 utilities in-app
 * Found by /qa on 2026-09-14
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-14.md
 *
 * Usage: node scripts/check-font-weight.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "..", "src");

const HEAVY = /\bfont-(?:bold|extrabold|black)\b|\bfont-\[(?:7|8|9)00\]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(tsx|ts|css)$/.test(entry) && !/\.test\./.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];

for (const file of walk(srcDir)) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const hits = line.match(HEAVY);
    if (hits) {
      offenders.push({ file: file.replace(srcDir, "src"), hit: hits.join(", "), line: index + 1 });
    }
  });
}

if (offenders.length > 0) {
  console.error(`check-font-weight: ${String(offenders.length)} weight(s) above 600:`);
  for (const { file, hit, line } of offenders) {
    console.error(`  ${file}:${String(line)}  ${hit}`);
  }
  console.error("Use font-semibold (600) or font-medium (500); DESIGN.md allows nothing heavier.");
  process.exit(1);
}

console.log("check-font-weight: no weight above 600 in src.");
