/**
 * The till header names whoever is signed in.
 *
 * Regression: ISSUE-070. The POS top bar's identity block read "Admin User"
 * for every account. On production on 2026-09-18 it said "Admin User" while
 * a restricted cashier was signed in, so staff at a shared counter could not
 * tell who the till belonged to. The receipt had the right name all along.
 *
 * Report: .gstack/qa-reports/qa-report-app-dmdpastries-com-2026-09-18.md
 *
 * Usage: node scripts/check-till-signed-in-name.mjs
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const topBar = readFileSync(resolve(rootDir, "src/components/pos/pos-top-bar.tsx"), "utf8");

// The name is rendered from the prop in both places the header shows it: the
// centre line (desktop) and the identity block beside the actions.
const uses = topBar.match(/\{cashierName\}/g) ?? [];
assert.ok(uses.length >= 2, "the top bar renders cashierName in both of its identity spots");

// No component may show a made-up identity as if it were the signed-in user.
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
for (const path of walk(resolve(rootDir, "src/components"))) {
  if (!path.endsWith(".tsx")) continue;
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    />\s*Admin User\s*</,
    `${path}: shows a hardcoded "Admin User" instead of the signed-in name`,
  );
}

console.log("till signed-in name: ok");
