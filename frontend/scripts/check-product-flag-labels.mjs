/**
 * A product capability badge must say which way round it is.
 *
 * The product Overview rendered one label per capability and swapped only the
 * badge colour, so a product that does NOT track expiry still read "Expiry
 * tracked", in grey instead of green. Colour was the only thing carrying the
 * meaning. To anyone who cannot separate a green tint from no tint, and to
 * every screen reader, the badge asserted the exact opposite of the truth.
 *
 * Measured on production on 2026-09-14, on Vanilla Cake, whose expiry tracking
 * and custom orders are both OFF:
 *
 *   label "Expiry tracked"  bg rgba(0,0,0,0)              color oklch(0.526 …)
 *   label "Sellable"        bg oklch(0.964 0.0181 155.8)  color oklch(0.4228 …)
 *
 * Same words, different tint, opposite meanings.
 *
 * The POS badge in the same row already had this right: its label reads
 * "POS: POS Visible" or "POS: Not Sellable", so the state is in the words.
 *
 * Regression: ISSUE-008 — product flag badges read the same whether the flag was on or off
 * Found by /qa on 2026-09-14
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 *
 * Usage: node scripts/check-product-flag-labels.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const panelPath = resolve(rootDir, "src/components/products/product-details-panel.tsx");
const source = readFileSync(panelPath, "utf8").replace(/\r\n/g, "\n");

// --- The badge must be given both wordings -------------------------------
//
// A single `label` prop is the shape of the bug: one string cannot describe
// two states, so the component is forced to lean on colour.

assert.ok(
  !/function Flag\([^)]*\blabel\b/.test(source),
  "Flag must not take a single `label`: one string cannot say both on and off, " +
    "which is what pushed the meaning into the badge colour",
);

for (const prop of ["onLabel", "offLabel"]) {
  assert.ok(
    source.includes(prop),
    `Flag must take ${prop} so the words change with the state, not just the tint`,
  );
}

assert.ok(
  /active \? onLabel : offLabel/.test(source),
  "Flag must render onLabel when active and offLabel when not; wiring both props and " +
    "then rendering one of them defeats the point",
);

// --- Every capability must supply a distinct off wording -----------------

const flagUses = [...source.matchAll(/<Flag\b([\s\S]*?)\/>/g)].map((match) => match[1]);
assert.ok(flagUses.length >= 4, `expected the four capability badges, found ${flagUses.length}`);

for (const use of flagUses) {
  const on = /onLabel=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(use);
  const off = /offLabel=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(use);
  const active = /active=\{([^}]*)\}/.exec(use);
  assert.ok(on && off, `a Flag is missing one of its labels: ${use.trim().slice(0, 80)}`);

  const onText = on[1] ?? on[2];
  const offText = off[1] ?? off[2];

  // The POS badge is the documented exception: its label already carries the
  // state, computed by getProductPosVisibilityLabel, so both sides are the
  // same expression on purpose.
  if (onText.startsWith("POS: ")) {
    assert.ok(
      onText.includes("getProductPosVisibilityLabel"),
      "the POS badge is only allowed identical labels because its text already " +
        "states the visibility; if it stops doing that it needs a real off wording",
    );
    continue;
  }

  assert.notEqual(
    onText,
    offText,
    `the ${active?.[1] ?? "unknown"} badge reads "${onText}" either way, so only colour ` +
      "tells an operator which it is",
  );
  assert.ok(
    offText.length > 0,
    `the ${active?.[1] ?? "unknown"} badge has an empty off label; a blank badge is not an answer`,
  );
}

console.log("check-product-flag-labels: product capability badges say which way round they are.");
