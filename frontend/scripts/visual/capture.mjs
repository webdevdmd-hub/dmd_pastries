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
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
  // Chrome's network-error page is a real document that screenshots cleanly,
  // so nothing downstream can tell it from the app. Bail loudly instead.
  if (document.querySelector("#main-frame-error")) return "CAPTURE_ERROR_PAGE";

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
  // Wait for real content before settling. \`wait --networkidle\` can return
  // while a client-side route is still resolving, which is how /accounting and
  // /dashboard/production first captured as blank white pages showing nothing
  // but the top loading bar. A blank baseline is not as obviously wrong as an
  // error page, so it survives review — worse, not better.
  const hasContent = () => (((document.body && document.body.innerText) || "").trim().length > 200);

  return new Promise((done) => {
    const deadline = Date.now() + 8000;
    const settle = () =>
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => done("settled"), 600);
      }));

    const check = () => {
      if (hasContent()) return settle();
      if (Date.now() > deadline) return done("CAPTURE_BLANK");
      setTimeout(check, 200);
    };
    check();
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

// ----------------------------------------------------------------- preflight
/**
 * Confirm the origin actually answers before anything else happens.
 *
 * This is the check whose absence produced 35 committed
 * ERR_CONNECTION_REFUSED baselines (commit 7f637b1, 8 distinct images across
 * 35 files). With the dev server down, `goto` still renders Chrome's
 * network-error page, `screenshot` still writes a valid PNG, and the trailing
 * `url` step still reports the requested localhost URL — so every route logged
 * `ok` and the run exited 0.
 *
 * Deliberately ordered BEFORE the rmSync below: a failed preflight must not
 * take the existing baselines down with it.
 */
try {
  const response = await fetch(baseUrl, { redirect: "manual" });
  if (response.status >= 500) {
    console.error(
      `${baseUrl} answered ${response.status}.\n` +
        `The server is up but erroring. Fix that first — a 500 page screenshots as cleanly as your app.`,
    );
    process.exit(1);
  }
} catch (error) {
  console.error(
    `${baseUrl} is not answering (${error.cause?.code ?? error.message}).\n\n` +
      `Start the dev server first:  cd frontend && pnpm dev\n\n` +
      `Refusing to capture. A dead origin screenshots Chrome's error page as if it were\n` +
      `your app, which is how commit 7f637b1 came to hold 35 identical error screens.`,
  );
  process.exit(1);
}

/**
 * Full runs start clean. `--only` runs do NOT.
 *
 * `--only` means "refresh these routes", so wiping the dir would delete every
 * route not named. That made retrying a flaky capture impossible: the browse
 * daemon fails a handful of routes per run with "Server failed to start" or a
 * taskkill race, and the only recovery was re-running all 35 and hoping a
 * different handful failed. Incremental retry is the whole reason `--only`
 * exists on a `--out baseline` run.
 */
if (existsSync(outDir) && only.length === 0) {
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
      const errorPage = stdout.includes("CAPTURE_ERROR_PAGE");
      const blankPage = stdout.includes("CAPTURE_BLANK");
      const captured = existsSync(file);

      // ...and the reverse, which the check above does NOT cover: a route that
      // redirects AWAY to somewhere else. `/login` bounces to the dashboard
      // whenever a session exists, so the committed `login` baseline was in fact a
      // screenshot of /dashboard/admin — a real page, distinct from its neighbours,
      // passing every other guard here, and simply the wrong route.
      //
      // The trailing `url` step already reported the truth; nothing compared it to
      // what was asked for. This does.
      const finalPath = (() => {
        const urls = stdout.match(/https?:\/\/[^\s]+/g) ?? [];
        const last = urls[urls.length - 1];
        if (!last) return null;
        try {
          return new URL(last).pathname.replace(/\/$/, "") || "/";
        } catch {
          return null;
        }
      })();
      const wanted = route.path.replace(/\/$/, "") || "/";
      // A route may declare where it legitimately lands (role-based dashboards,
      // index routes that forward to a default tab). Declared destinations pass;
      // undeclared ones fail, so the harness can never again quietly screenshot
      // one page under another page's name.
      const allowed = route.redirectsTo?.replace(/\/$/, "") ?? wanted;
      const redirected = finalPath !== null && finalPath !== allowed && !landedOnLogin;

      if (errorPage || blankPage) {
        // Delete it. A retained error-page or blank PNG is worse than a missing
        // file, because the next `visual:diff` treats it as a valid reference.
        rmSync(file, { force: true });
        failures.push({
          label,
          reason: errorPage
            ? "Chrome error page, not the app (origin died mid-run?)"
            : "never rendered content — still resolving after 8s",
        });
        console.log(`${progress} ${errorPage ? "ERRPG" : "BLANK"} ${label}`);
      } else if (landedOnLogin) {
        failures.push({ label, reason: "redirected to /login (session expired?)" });
        console.log(`${progress} AUTH  ${label}`);
      } else if (redirected) {
        // Delete it: a screenshot of the wrong route is the most misleading kind
        // of baseline, because it looks entirely plausible in review.
        rmSync(file, { force: true });
        failures.push({
          label,
          reason: `redirected to ${String(finalPath)}, expected ${allowed} — captured the wrong page`,
        });
        console.log(`${progress} REDIR ${label}`);
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

// ------------------------------------------------------- degenerate-set check
/**
 * Backstop for "every route captured the same thing", whatever the cause.
 *
 * 7f637b1 committed 35 files holding 8 distinct images: login, pos,
 * dashboard-cashier and acc-trial-balance were byte-identical. Distinct routes
 * render distinct pixels, so if fewer than half of them do, this run captured
 * something other than the app and must not become a reference.
 *
 * Unlike the preflight and the error-page guard, this one is cause-agnostic —
 * it catches the next failure mode nobody predicted.
 */
const written = [];
for (const route of selected) {
  for (const viewportName of route.viewports ?? ["ledger"]) {
    for (const scheme of schemes) {
      const file = join(outDir, `${route.name}__${viewportName}__${scheme}.png`);
      if (existsSync(file)) written.push(file);
    }
  }
}

if (written.length > 4) {
  const hashes = new Set(
    written.map((file) => createHash("sha256").update(readFileSync(file)).digest("hex")),
  );
  console.log(`${hashes.size} distinct images across ${written.length} captures`);

  if (hashes.size * 2 < written.length) {
    console.error(
      `\nDegenerate capture: ${hashes.size} distinct images across ${written.length} files.\n` +
        `Distinct routes should render distinct pixels. This run captured something other\n` +
        `than the app — do not commit it as a baseline.`,
    );
    process.exit(1);
  }
}

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
