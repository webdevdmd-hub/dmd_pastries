/**
 * Assert the categorical chart series stays readable, including for viewers with
 * red-green colour vision deficiency.
 *
 * WHY THIS EXISTS
 *
 * `src/lib/design/palette.ts` used to carry the comment "distinguishable under
 * deuteranopia and protanopia" with nothing verifying it. A comment is not a check,
 * and a line chart is the one place in this design system where colour genuinely is
 * the only carrier of meaning: a badge has a dot and a label to fall back on, a line
 * has neither. About 8% of men have a red-green deficiency, and the series contains
 * both a green and a red.
 *
 * METHOD
 *
 * sRGB -> linear -> LMS, then the Viénot, Brettel & Mollon (1999) dichromat
 * projection for protanopia and deuteranopia, then back to sRGB and into CIE Lab to
 * measure CIE76 dE between pairs. Viénot is the standard single-plane
 * approximation; it is not a perceptual ground truth, but it reliably catches the
 * failure mode that matters here — two series that are obviously different to
 * trichromats collapsing onto each other.
 *
 * Adjacent pairs get the strict threshold because they are what a reader compares
 * first in a legend and what sits next to each other in a stacked bar. Every other
 * pair gets a looser one.
 */

import { readFileSync } from "node:fs";

const ADJACENT_MIN = 18;
const ANY_PAIR_MIN = 9;

/**
 * Read the series out of palette.ts rather than keeping a copy here.
 *
 * A duplicated list is the exact hazard palette.ts itself warns about: the two
 * drift, the check keeps passing against colours nobody ships, and the guarantee
 * quietly becomes fiction. Parsing is crude but it cannot go stale — and if the
 * shape of the export changes, this fails loudly instead of silently checking the
 * wrong thing.
 */
const PALETTE_PATH = "src/lib/design/palette.ts";

function readChartSeries() {
  const source = readFileSync(PALETTE_PATH, "utf8");
  const match = /export const chartSeries = \[([\s\S]*?)\] as const;/.exec(source);

  if (!match) {
    console.error(`Could not find 'export const chartSeries' in ${PALETTE_PATH}.`);
    console.error("If that export was renamed or reshaped, update this script to match.");
    process.exit(1);
  }

  const colours = match[1].match(/#[0-9A-Fa-f]{6}\b/g) ?? [];

  if (colours.length < 2) {
    console.error(
      `Parsed ${String(colours.length)} colours from chartSeries; expected at least 2.`,
    );
    process.exit(1);
  }

  // Trailing comment on each entry is the token name, which makes failures readable.
  const labels = match[1]
    .split("\n")
    .map((line) => /#[0-9A-Fa-f]{6}[^/]*\/\/\s*(.+?)\s*$/.exec(line)?.[1])
    .filter(Boolean)
    // Keep the token name only; the rest of the comment is prose.
    .map((label) => label.split(/[,—-]/)[0].trim());

  return {
    colours,
    names: colours.map((_, i) => labels[i] ?? `series${String(i)}`),
  };
}

const { colours: chartSeries, names } = readChartSeries();

// --------------------------------------------------------------------- colour
function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [
    Number.parseInt(v.slice(0, 2), 16) / 255,
    Number.parseInt(v.slice(2, 4), 16) / 255,
    Number.parseInt(v.slice(4, 6), 16) / 255,
  ];
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clamp = (c) => Math.min(1, Math.max(0, c));

/** Viénot 1999 dichromat simulation, operating on linear RGB. */
function simulate(rgbLinear, kind) {
  const [r, g, b] = rgbLinear;

  // linear RGB -> LMS (Hunt-Pointer-Estevez, as used by Viénot)
  const l = 17.8824 * r + 43.5161 * g + 4.11935 * b;
  const m = 3.45565 * r + 27.1554 * g + 3.86714 * b;
  const s = 0.0299566 * r + 0.184309 * g + 1.46709 * b;

  let l2 = l;
  let m2 = m;
  const s2 = s;

  if (kind === "protan") {
    l2 = 2.02344 * m - 2.52581 * s;
  } else if (kind === "deutan") {
    m2 = 0.494207 * l + 1.24827 * s;
  }

  // LMS -> linear RGB
  return [
    0.080944 * l2 - 0.130504 * m2 + 0.116721 * s2,
    -0.0102485 * l2 + 0.0540194 * m2 - 0.113615 * s2,
    -0.000365294 * l2 - 0.00412163 * m2 + 0.693513 * s2,
  ];
}

function rgbLinearToLab([r, g, b]) {
  // linear sRGB -> XYZ (D65)
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;

  const wx = 0.95047;
  const wy = 1;
  const wz = 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / wx);
  const fy = f(y / wy);
  const fz = f(z / wz);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(labA, labB) {
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

function labFor(hex, kind) {
  const linear = hexToRgb(hex).map(toLinear);
  const seen = kind === "normal" ? linear : simulate(linear, kind).map(clamp);
  // Round-trip through sRGB so the simulated colour is one a display can show.
  return rgbLinearToLab(seen.map(toSrgb).map(clamp).map(toLinear));
}

// ----------------------------------------------------------------------- main
const failures = [];
const report = [];

for (const kind of ["normal", "protan", "deutan"]) {
  const labs = chartSeries.map((hex) => labFor(hex, kind));
  let worstAdjacent = Infinity;
  let worstAny = Infinity;
  let worstAnyPair = "";

  for (let i = 0; i < chartSeries.length; i += 1) {
    for (let j = i + 1; j < chartSeries.length; j += 1) {
      const d = deltaE(labs[i], labs[j]);
      const adjacent = j === i + 1;
      const pair = `${names[i]}/${names[j]}`;

      if (adjacent) {
        worstAdjacent = Math.min(worstAdjacent, d);
        if (d < ADJACENT_MIN) {
          failures.push(
            `${kind}: adjacent pair ${pair} is dE ${d.toFixed(1)} (min ${ADJACENT_MIN})`,
          );
        }
      }

      if (d < worstAny) {
        worstAny = d;
        worstAnyPair = pair;
      }

      if (d < ANY_PAIR_MIN) {
        failures.push(`${kind}: pair ${pair} is dE ${d.toFixed(1)} (min ${ANY_PAIR_MIN})`);
      }
    }
  }

  report.push(
    `  ${kind.padEnd(7)} worst adjacent dE ${worstAdjacent.toFixed(1)}` +
      `   worst any dE ${worstAny.toFixed(1)} (${worstAnyPair})`,
  );
}

console.log(`Chart series: ${chartSeries.length} colours, red-green CVD simulated`);
console.log(report.join("\n"));

if (failures.length > 0) {
  console.error(`\n${failures.length} chart palette failure(s):`);
  for (const failure of failures) {
    console.error(`  ${failure}`);
  }
  console.error(
    "\nEither reorder chartSeries so adjacent entries separate further, or drop a\n" +
      "colour. Note chartSeriesDash exists precisely because colour alone is not\n" +
      "enough on a line chart — but a legend still has to be readable.",
  );
  process.exit(1);
}

console.log("Chart series is distinguishable under normal, protan and deutan vision.");
