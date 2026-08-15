#!/usr/bin/env node
/**
 * Visual regression capture.
 *
 * Drives the gstack browse binary to screenshot every route in routes.mjs,
 * at each configured viewport and color scheme, into visual/<out>/.
 *
 * Usage:
 *   node scripts/visual/capture.mjs --out baseline
 *   node scripts/visual/capture.mjs --out current --only pos,orders
 *   node scripts/visual/capture.mjs --out current --schemes light,dark
 *
 * Options:
 *   --out <dir>       output dir under visual/  (default: current)
 *   --base-url <url>  app origin                (default: http://localhost:3000)
 *   --schemes <list>  light | dark | light,dark (default: light)
 *   --only <list>     comma-separated route names, substring match
 *   --browse <path>   override the browse binary path
 *
 * IMPORTANT — read before trusting a clean report:
 * every route renders live data. If the dataset changes between two runs, the
 * diff is red for reasons that have nothing to do with CSS. Point this at a
 * frozen staging dataset. Without that, this tool reports noise and everyone
 * learns to ignore it, which is worse than not having it.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { routes, schemes as allSchemes, viewports } from "./routes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..", "..");

// ---------------------------------------------------------------- arguments
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const outName = arg("out", "current");
const baseUrl = arg("base-url", "http://localhost:3000").replace(/\/$/, "");
const schemes = arg("schemes", "light")
  .split(",")
  .map((s) => s.trim());
const only = arg("only", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const browseBin = arg(
  "browse",
  join(homedir(), ".claude", "skills", "gstack", "browse", "dist", "browse.exe"),
);

/**
 * Whether to drive a headed browse daemon. Required whenever the routes need
 * a logged-in session that was established by hand. Default on: every route
 * except /login sits behind auth.
 */
const headed = !process.argv.includes("--no-headed");

const outDir = join(frontendRoot, "visual", outName);

// ------------------------------------------------------------------ helpers
/**
 * Run one browse chain. Steps are [command, ...args] tuples.
 *
 * `--headed` matters more than it looks. Browse keys its daemon on startup
 * config, so a command that omits the flag is treated as a request for a
 * DIFFERENT daemon: the running headed one gets torn down and the logged-in
 * session goes with it. On Windows the auth session can only be established by
 * hand in a headed window (Chrome's App-Bound Encryption blocks importing
 * cookies from a real browser), so losing that daemon means logging in again.
 * Pass --headed on every single call.
 */
function chain(steps) {
  return new Promise((resolvePromise) => {
    const args = headed ? ["--headed", "chain"] : ["chain"];
    const child = spawn(browseBin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
    child.stdin.write(JSON.stringify(steps));
    child.stdin.end();
  });
}

/**
 * Injected after load, before capture.
 * Neutralizes the three things that make screenshots differ run to run for
 * reasons unrelated to design: CSS animation, chart mount animation, and the
 * caret. Time pinning here is best-effort only — it lands after hydration, so
 * it cannot fix server-rendered or already-rendered timestamps. A frozen
 * dataset is the real fix.
 */
function settleScript(scheme) {
  return `
(() => {
  const root = document.documentElement;
  ${scheme === "dark" ? `root.dataset.theme = "dark"; root.classList.add("dark");` : `root.dataset.theme = "light"; root.classList.remove("dark");`}

  const style = document.createElement("style");
  style.textContent = \`
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
    }
    html { scroll-behavior: auto !important; }
  \`;
  document.head.appendChild(style);

  window.scrollTo(0, 0);

  // Two frames for layout, then a beat for chart libraries that animate via
  // requestAnimationFrame and ignore CSS overrides.
  return new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTimeout(() => done("settled"), 600);
    }));
  });
})()`;
}

// --------------------------------------------------------------------- main
const selected = routes.filter(
  (route) => only.length === 0 || only.some((needle) => route.name.includes(needle)),
);

if (selected.length === 0) {
  console.error(`No routes matched --only "${only.join(",")}"`);
  process.exit(1);
}

for (const scheme of schemes) {
  if (!allSchemes.includes(scheme)) {
    console.error(`Unknown scheme "${scheme}". Known: ${allSchemes.join(", ")}`);
    process.exit(1);
  }
}

if (!existsSync(browseBin)) {
  console.error(`browse binary not found at ${browseBin}\nPass --browse <path>.`);
  process.exit(1);
}

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

const failures = [];
let shot = 0;

const total = selected.reduce(
  (sum, route) => sum + (route.viewports ?? ["ledger"]).length * schemes.length,
  0,
);

console.log(`Capturing ${total} screenshots into visual/${outName}`);
console.log(`Base URL: ${baseUrl}\n`);

for (const route of selected) {
  for (const viewportName of route.viewports ?? ["ledger"]) {
    const viewport = viewports[viewportName];

    for (const scheme of schemes) {
      const label = `${route.name}__${viewportName}__${scheme}`;
      const file = join(outDir, `${label}.png`);

      const { stdout, stderr } = await chain([
        ["viewport", `${viewport.width}x${viewport.height}`],
        ["goto", `${baseUrl}${route.path}`],
        ["wait", "--networkidle"],
        ["js", settleScript(scheme)],
        ["screenshot", "--viewport", file],
        ["url"],
      ]);

      shot += 1;
      const progress = `[${String(shot).padStart(3)}/${total}]`;

      // A redirect to /login means the session expired. Without this check the
      // harness happily baselines 30 identical login screens and reports green.
      const landedOnLogin = /\/login/.test(stdout) && route.auth !== false;
      const captured = existsSync(file);

      if (landedOnLogin) {
        failures.push({ label, reason: "redirected to /login (session expired?)" });
        console.log(`${progress} AUTH  ${label}`);
      } else if (!captured) {
        // Surface the actual ERROR line. Taking the last line of stdout gets
        // the trailing `url` step instead, which reports a perfectly correct
        // URL and makes a real failure look like a mystery.
        const lines = `${stdout}\n${stderr}`.split("\n").map((l) => l.trim());
        const detail =
          lines.find((l) => l.includes("ERROR:")) ??
          lines.filter(Boolean).slice(-1)[0] ??
          "no output";
        failures.push({ label, reason: detail });
        console.log(`${progress} FAIL  ${label}`);
      } else {
        console.log(`${progress} ok    ${label}`);
      }
    }
  }
}

console.log(`\nWrote ${shot - failures.length}/${total} screenshots to visual/${outName}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} capture failure(s):`);
  for (const failure of failures) {
    console.error(`  ${failure.label}: ${failure.reason}`);
  }
  if (failures.some((f) => f.reason.includes("/login"))) {
    console.error(
      `\nSession looks expired. Refresh cookies with:\n` +
        `  ${browseBin} cookie-import-browser chrome --domain localhost`,
    );
  }
  process.exit(1);
}

console.log("All routes captured.");
