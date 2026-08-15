#!/usr/bin/env node
/**
 * Visual regression compare.
 *
 * Diffs two capture directories and writes visual/report.html with a
 * side-by-side view of everything that changed.
 *
 * Usage:
 *   node scripts/visual/compare.mjs baseline current
 *   node scripts/visual/compare.mjs baseline current --open
 *
 * Why content hashing instead of pixelmatch:
 * capture.mjs disables animation and transition, pins scroll, and waits for
 * network idle, so the same headless Chromium rendering the same content at
 * the same viewport produces a byte-identical PNG. A hash therefore answers
 * "did anything change" exactly, with no dependency and no false-precision
 * percentage. It cannot say *how much* changed — that is what the HTML report
 * is for, and a human reading a side-by-side is a better judge than a
 * threshold anyway.
 *
 * If rendering ever turns out to be nondeterministic (a font race, GPU
 * subpixel drift), the escape hatch is `pnpm add -D pixelmatch pngjs` and
 * swapping hashOf() for a per-pixel compare. Do that only if a no-op run
 * reports changes — not preemptively.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..", "..");
const visualRoot = join(frontendRoot, "visual");

const [, , baseArg = "baseline", headArg = "current"] = process.argv;
const baseDir = join(visualRoot, baseArg);
const headDir = join(visualRoot, headArg);

for (const [name, dir] of [
  [baseArg, baseDir],
  [headArg, headDir],
]) {
  if (!existsSync(dir)) {
    console.error(`Missing capture directory: visual/${name}`);
    console.error(`Run: node scripts/visual/capture.mjs --out ${name}`);
    process.exit(1);
  }
}

const hashOf = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const pngsIn = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort();

const basePngs = pngsIn(baseDir);
const headPngs = pngsIn(headDir);
const allNames = [...new Set([...basePngs, ...headPngs])].sort();

const changed = [];
const added = [];
const removed = [];
let unchanged = 0;

for (const name of allNames) {
  const inBase = basePngs.includes(name);
  const inHead = headPngs.includes(name);

  if (!inBase) {
    added.push(name);
  } else if (!inHead) {
    removed.push(name);
  } else if (hashOf(join(baseDir, name)) !== hashOf(join(headDir, name))) {
    changed.push(name);
  } else {
    unchanged += 1;
  }
}

// ------------------------------------------------------------------- report
const relBase = `./${baseArg}`;
const relHead = `./${headArg}`;

const card = (name, kind) => {
  const pair =
    kind === "changed"
      ? `<div class="pair">
           <figure><figcaption>before</figcaption><img loading="lazy" src="${relBase}/${name}"></figure>
           <figure><figcaption>after</figcaption><img loading="lazy" src="${relHead}/${name}"></figure>
         </div>`
      : `<div class="pair one">
           <figure><figcaption>${kind}</figcaption><img loading="lazy" src="${kind === "removed" ? relBase : relHead}/${name}"></figure>
         </div>`;
  return `<section class="shot ${kind}"><h2>${name.replace(/\.png$/, "")}<span class="badge ${kind}">${kind}</span></h2>${pair}</section>`;
};

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visual diff — ${baseArg} vs ${headArg}</title>
<style>
  :root { color-scheme: light dark; --bg:#fcfcfc; --fg:#0a0a0a; --muted:#737373; --line:#e5e5e5; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0a0a0a; --fg:#fafafa; --muted:#a1a1a1; --line:#2a2a2a; --card:#171717; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 ui-sans-serif,system-ui,sans-serif; padding:40px 24px 80px; }
  .wrap { max-width:1600px; margin:0 auto; }
  h1 { font-size:28px; letter-spacing:-.03em; margin:0 0 8px; }
  .summary { color:var(--muted); margin:0 0 32px; }
  .summary b { color:var(--fg); font-weight:600; }
  .shot { background:var(--card); border:1px solid var(--line); border-radius:10px; margin-bottom:20px; overflow:hidden; }
  .shot h2 { font-size:14px; font-weight:500; margin:0; padding:12px 16px; border-bottom:1px solid var(--line); display:flex; gap:10px; align-items:center; }
  .badge { font:11px/1 ui-monospace,monospace; padding:4px 8px; border-radius:999px; }
  .badge.changed { background:#fef4df; color:#7b4800; }
  .badge.added   { background:#eaf8ee; color:#005e31; }
  .badge.removed { background:#ffefee; color:#9e1618; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line); }
  .pair.one { grid-template-columns:1fr; }
  figure { margin:0; background:var(--card); }
  figcaption { font:11px/1 ui-monospace,monospace; color:var(--muted); padding:8px 12px; }
  img { display:block; width:100%; height:auto; }
  .none { color:var(--muted); padding:48px 0; text-align:center; }
</style></head>
<body><div class="wrap">
  <h1>Visual diff</h1>
  <p class="summary">
    <b>${baseArg}</b> vs <b>${headArg}</b> &middot;
    <b>${changed.length}</b> changed &middot;
    <b>${added.length}</b> added &middot;
    <b>${removed.length}</b> removed &middot;
    ${unchanged} unchanged
  </p>
  ${
    changed.length + added.length + removed.length === 0
      ? `<p class="none">No visual changes.</p>`
      : [
          ...changed.map((n) => card(n, "changed")),
          ...added.map((n) => card(n, "added")),
          ...removed.map((n) => card(n, "removed")),
        ].join("\n")
  }
</div></body></html>`;

const reportPath = join(visualRoot, "report.html");
writeFileSync(reportPath, html, "utf8");

// ------------------------------------------------------------------ console
console.log(
  `\n  ${changed.length} changed   ${added.length} added   ${removed.length} removed   ${unchanged} unchanged\n`,
);

for (const name of changed) console.log(`  changed  ${name.replace(/\.png$/, "")}`);
for (const name of added) console.log(`  added    ${name.replace(/\.png$/, "")}`);
for (const name of removed) console.log(`  removed  ${name.replace(/\.png$/, "")}`);

console.log(`\nReport: ${reportPath}`);

if (process.argv.includes("--open")) {
  const { spawn } = await import("node:child_process");
  const opener =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", reportPath]]
      : process.platform === "darwin"
        ? ["open", [reportPath]]
        : ["xdg-open", [reportPath]];
  spawn(opener[0], opener[1], { detached: true, stdio: "ignore" }).unref();
}

// Non-zero only when files vanish or appear unexpectedly. A changed pixel is
// information for a human to review, not a build failure — gating merges on it
// would train everyone to pass --force.
process.exit(added.length + removed.length > 0 ? 1 : 0);
