/**
 * The Appwrite JWT cache must live in localStorage, not sessionStorage.
 *
 * Appwrite caps createJWT() per user per hour in fixed hourly buckets, and the
 * app asks for a token on every full page load. sessionStorage is scoped to one
 * tab, so a cache kept there costs a fresh token for every tab, every new
 * window and every reopened tab -- an owner with the dashboard, the register
 * and a report open spends three times the budget of one person, and the whole
 * account is locked out until the top of the hour when it runs dry.
 *
 * localStorage makes the token device-wide. The rate-limit marker has to move
 * with it, or a device that has already hit the limit retries from a second tab
 * and re-arms the same bucket.
 *
 * This fails silently if it regresses: logins keep working, the app just
 * quietly spends several times the budget it needs, and the breakage shows up
 * as intermittent lockouts nobody can reproduce.
 *
 * Usage: node scripts/check-jwt-cache-storage.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = "src/lib/appwrite/auth.ts";
const source = readFileSync(resolve(here, "..", target), "utf8");

const failures = [];

// Matches real uses (window.sessionStorage, sessionStorage.getItem) but not the
// doc comment above the keys, which has to name sessionStorage to explain why
// the cache left it.
const sessionUses = source
  .split(/\r?\n/)
  .flatMap((line, index) =>
    /window\.sessionStorage|sessionStorage\s*[.[]/.test(line)
      ? [`${target}:${index + 1}  ${line.trim()}`]
      : [],
  );

if (sessionUses.length > 0) {
  failures.push(
    `The JWT cache is back in sessionStorage, which is per tab:\n\n${sessionUses
      .map((hit) => `      ${hit}`)
      .join("\n")}`,
  );
}

for (const fn of ["readStorage", "writeStorage"]) {
  const start = source.indexOf(`function ${fn}(`);
  if (start === -1) {
    failures.push(`${fn}() is gone from ${target}; the persisted cache has no single door left.`);
    continue;
  }
  const body = source.slice(start, source.indexOf("\n}", start));
  if (!body.includes("window.localStorage")) {
    failures.push(`${fn}() no longer reaches window.localStorage.`);
  }
}

// Both keys go through the same door, so the marker cannot drift back to a
// per-tab store while the token stays device-wide.
for (const key of ["jwtStorageKey", "jwtRateLimitStorageKey"]) {
  if (!source.includes(`const ${key} =`)) {
    failures.push(`${key} is missing from ${target}.`);
  }
}

if (failures.length > 0) {
  console.error("\n  JWT cache storage FAILED.\n");
  for (const failure of failures) {
    console.error(`    ${failure}\n`);
  }
  console.error(
    "  Appwrite's hourly createJWT budget is per user, not per tab. Keep the\n" +
      "  token and the rate-limit marker in localStorage so every tab on the\n" +
      "  device draws from one token.\n",
  );
  process.exit(1);
}

console.log("  JWT cache storage OK: the Appwrite token is cached device-wide in localStorage.");
