/**
 * Every public env key must actually be readable, not just declared.
 *
 * `PublicEnvKey` is a union of names. Adding a name to it makes
 * getPublicEnvValue("...") compile — and return undefined forever, unless the
 * key is also listed in `buildTimePublicEnv`. Nothing errors. The feature
 * behind the variable simply never switches on, and the environment looks
 * correctly configured because the variable is set exactly as documented.
 *
 * That happened. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * NEXT_PUBLIC_AUTH_PROVIDER and NEXT_PUBLIC_STORAGE_PROVIDER were added to the
 * union and to nothing else, so both migration seams read "not configured" and
 * stayed on Appwrite. Setting all four at cutover would have changed nothing,
 * with no error to explain why -- which is the worst possible morning to
 * discover a variable is inert.
 *
 * The runtime half of this can no longer drift: env-config.js/route.ts imports
 * PublicEnvKey instead of restating it, so an unlisted key fails to compile.
 * The build-time map has no such protection, because it is an array of tuples
 * rather than an exhaustive record. This is that protection.
 *
 * Usage: node scripts/check-public-env-wired.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src", "lib", "public-env.ts"), "utf8");

function declaredKeys() {
  const start = source.indexOf("export type PublicEnvKey =");
  const end = source.indexOf(";", start);
  const body = source.slice(start, end);

  return new Set([...body.matchAll(/"(NEXT_PUBLIC_[A-Z0-9_]+)"/g)].map((match) => match[1]));
}

function wiredKeys() {
  const start = source.indexOf("const buildTimePublicEnv = createPublicEnv([");
  const end = source.indexOf("]);", start);
  const body = source.slice(start, end);

  return new Set([...body.matchAll(/"(NEXT_PUBLIC_[A-Z0-9_]+)"/g)].map((match) => match[1]));
}

const declared = declaredKeys();
const wired = wiredKeys();

if (declared.size === 0 || wired.size === 0) {
  console.error(
    "\n  Public env wiring FAILED.\n" +
      "  Could not read the key union or the build-time map from lib/public-env.ts.\n" +
      "  If that file was restructured, update this script -- do not delete the check.\n",
  );
  process.exit(1);
}

const unwired = [...declared].filter((key) => !wired.has(key));

if (unwired.length > 0) {
  console.error("\n  Public env wiring FAILED.");
  console.error("  These keys are declared but never read from the environment:\n");
  for (const key of unwired) {
    console.error(`    ${key}`);
  }
  console.error(
    "\n  getPublicEnvValue returns undefined for them, whatever the deployment\n" +
      "  sets. Add each one to buildTimePublicEnv in src/lib/public-env.ts.\n",
  );
  process.exit(1);
}

console.log(
  `  Public env wiring OK: all ${declared.size} declared keys are read from the environment.`,
);
