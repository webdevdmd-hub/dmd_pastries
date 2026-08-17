/**
 * Asserts that every CSS custom property the Tailwind config asks for is
 * actually declared by the token layer.
 *
 * This exists because the failure it catches is completely silent. Tailwind
 * emits `oklch(var(--canvas) / <alpha-value>)` for a colour whether or not
 * `--canvas` exists. If it does not, the declaration is invalid at
 * computed-value time and the browser drops it: no build error, no lint
 * error, no console warning. The page simply paints nothing, and a
 * successful build deploys it.
 *
 * That is exactly what would have happened when DESIGN.md v3 renamed
 * `--background` to `--canvas` and `--accent-*` to `--money-*` without the
 * config and tokens.css following.
 *
 * Usage:
 *   node scripts/check-token-agreement.mjs                  # proposed files
 *   node scripts/check-token-agreement.mjs --live           # shipped files
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const live = process.argv.includes("--live");

const configPath = live
  ? resolve(repo, "frontend/tailwind.config.ts")
  : resolve(repo, "docs/design/tailwind.config.proposed.ts");
const tokensPath = live
  ? resolve(repo, "frontend/src/app/globals.css")
  : resolve(repo, "docs/design/tokens.css");

/** Fonts are declared by next/font in layout.tsx, not by the token layer. */
const EXTERNAL = new Set(["font-sans", "font-mono", "font-serif", "font-display"]);

/** Strip comments so prose examples inside them are not read as references. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function main() {
  const config = stripComments(readFileSync(configPath, "utf8"));
  const tokens = stripComments(readFileSync(tokensPath, "utf8"));

  const wanted = new Set();
  // The `c("name")` helper, and any raw var(--name) in the config.
  for (const m of config.matchAll(/\bc\(\s*["'`]([a-z0-9-]+)["'`]\s*\)/g)) wanted.add(m[1]);
  for (const m of config.matchAll(/var\(\s*--([a-z0-9-]+)/g)) wanted.add(m[1]);

  const declared = new Set();
  for (const m of tokens.matchAll(/^\s*--([a-z0-9-]+)\s*:/gm)) declared.add(m[1]);

  const missing = [...wanted].filter((n) => !declared.has(n) && !EXTERNAL.has(n)).sort();

  const label = live ? "live" : "proposed";
  if (missing.length > 0) {
    console.error(`\n  Token agreement FAILED (${label}).`);
    console.error(`  ${configPath.replace(repo, ".")} references variables that`);
    console.error(`  ${tokensPath.replace(repo, ".")} does not declare.\n`);
    for (const name of missing) console.error(`    --${name}`);
    console.error(
      `\n  Each one silently drops its declaration in the browser: no build\n` +
        `  error, no lint error, a blank surface. Define it or alias it.\n`,
    );
    process.exit(1);
  }

  console.log(
    `  Token agreement OK (${label}): ${wanted.size} referenced, ${declared.size} declared, 0 missing.`,
  );
}

main();
