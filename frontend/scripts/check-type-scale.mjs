/**
 * Asserts that every semantic `text-<name>` class used in src is declared in
 * the Tailwind config's fontSize block.
 *
 * This exists because the failure it catches is completely silent, in the same
 * way the token-agreement failure is. Tailwind emits nothing at all for a
 * utility it does not recognise: no build error, no lint error, no console
 * warning. The element simply inherits its parent's size and the page looks
 * plausible, so nobody notices.
 *
 * That is exactly what happened with `text-section`. It was used 34 times
 * across the app, was never declared in tailwind.config.ts, and was never in
 * DESIGN.md's scale either -- so every one of those elements rendered at the
 * inherited body size instead of the size its author intended.
 *
 * Tailwind's own numeric sizes (text-xs ... text-9xl) are allowed: they are
 * real utilities. DESIGN.md discourages them in favour of the semantic scale,
 * but that is a style rule for the linter, not a silent-failure bug.
 *
 * Usage:
 *   node scripts/check-type-scale.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");

const TAILWIND_BUILTIN = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

/** `text-left`, `text-danger-text` and friends are alignment and colour, not size. */
const NOT_A_SIZE =
  /^(left|right|center|justify|start|end|wrap|nowrap|balance|pretty|clip|ellipsis|transparent|current|inherit)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "node_modules" && entry !== ".next") walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const configPath = join(repo, "tailwind.config.ts");
  const config = readFileSync(configPath, "utf8");

  const fontSizeBlock = config.slice(
    config.indexOf("fontSize: {"),
    config.indexOf("\n      }", config.indexOf("fontSize: {")),
  );
  const declared = new Set([...fontSizeBlock.matchAll(/^\s{8}([a-z0-9-]+):/gm)].map((m) => m[1]));

  const offenders = new Map();
  for (const file of walk(join(repo, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/\btext-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\b/g)) {
      const name = m[1];
      if (TAILWIND_BUILTIN.has(name) || NOT_A_SIZE.test(name)) continue;
      // A colour token shares the `text-` prefix; only flag names that look
      // like a size and are not declared as one anywhere.
      if (declared.has(name)) continue;
      if (
        !/^(section|title|body|meta|cell|page|kpi|total|display|heading|caption|label|subtitle)$/.test(
          name,
        )
      ) {
        continue;
      }
      if (!offenders.has(name)) offenders.set(name, new Set());
      offenders.get(name).add(file.replace(repo, "."));
    }
  }

  if (offenders.size > 0) {
    console.error("\n  Type scale FAILED.");
    console.error("  These semantic text-* classes are used but not declared in");
    console.error("  tailwind.config.ts fontSize:\n");
    for (const [name, files] of [...offenders].sort()) {
      console.error(`    text-${name}  (${files.size} file(s))`);
      for (const f of [...files].sort().slice(0, 5)) console.error(`      ${f}`);
      if (files.size > 5) console.error(`      ... and ${files.size - 5} more`);
    }
    console.error(
      "\n  Tailwind emits nothing for an unknown utility, so each of these\n" +
        "  renders at its inherited size with no error anywhere. Declare it in\n" +
        "  the config and in DESIGN.md's scale, or use an existing token.\n",
    );
    process.exit(1);
  }

  console.log(`  Type scale OK: ${declared.size} sizes declared, every semantic text-* resolves.`);
}

main();
