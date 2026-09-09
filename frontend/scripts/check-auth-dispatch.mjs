/**
 * Every provider-facing function in the seam must dispatch on the provider.
 *
 * A function that calls Appwrite directly still works perfectly today, passes
 * every test, and reviews clean -- because Appwrite is what runs today. It
 * breaks at cutover, on that one path, while everything around it works. That
 * is the worst possible time and the worst possible shape for a bug: not an
 * outage anyone can see, but one screen behaving as though a specific employee
 * were signed out.
 *
 * So: if a function in lib/auth/session mentions Appwrite, it must also mention
 * supabaseIsActive(). Not a proof of correctness -- a proof that somebody thought
 * about the other provider when they wrote it.
 *
 * The mirror check matters too. lib/supabase/auth must implement everything the
 * seam dispatches to, or the dispatch is to a function that does not exist.
 *
 * Usage: node scripts/check-auth-dispatch.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, "..", path), "utf8");

const seam = read("src/lib/auth/session.ts");
const supabaseImpl = read("src/lib/supabase/auth.ts");

const failures = [];

// Split the seam into top-level functions and inspect each body.
const functionPattern = /^export (?:async )?function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)^\}/gm;

const dispatchExempt = new Set([
  "activeAuthProvider", // decides the provider; cannot dispatch on itself
  "purgeInactiveProviderState", // deliberately touches BOTH providers' storage
]);

const seamFunctions = [];
for (const [, name, body] of seam.matchAll(functionPattern)) {
  seamFunctions.push(name);

  if (dispatchExempt.has(name)) {
    continue;
  }

  const touchesAppwrite = /Appwrite/.test(body);
  const dispatches = /supabaseIsActive\(\)/.test(body);

  if (touchesAppwrite && !dispatches) {
    failures.push(
      `${name}() calls Appwrite without checking the provider, so it would keep ` +
        `calling Appwrite after cutover while every other path moved`,
    );
  }
}

if (seamFunctions.length === 0) {
  failures.push(
    "no exported functions found in lib/auth/session.ts; this check has stopped working",
  );
}

// Anything the seam routes to Supabase must actually exist over there.
for (const [, called] of seam.matchAll(/supabase\.(\w+)\(/g)) {
  const declared = new RegExp(`export (async )?function ${called}\\b`).test(supabaseImpl);
  if (!declared) {
    failures.push(`the seam calls supabase.${called}(), which lib/supabase/auth does not export`);
  }
}

// The Supabase client is auth-only. A data query from the browser would bypass
// 1,089 Go-side tenant predicates against tables that have no RLS policies.
if (
  /\.from\(|\.rpc\(/.test(supabaseImpl) ||
  /\.from\(|\.rpc\(/.test(read("src/lib/supabase/client.ts"))
) {
  failures.push(
    "the Supabase client is being used to query data. Every table relies on " +
      "tenant predicates that exist only in the Go API -- data must go through it",
  );
}

if (failures.length > 0) {
  console.error("\n  Auth dispatch FAILED.\n");
  for (const failure of failures) {
    console.error(`    - ${failure}`);
  }
  console.error(
    "\n  The seam only earns its keep if every path through it asks which\n" +
      "  provider is live. One that does not is invisible until cutover.\n",
  );
  process.exit(1);
}

console.log(`  Auth dispatch OK: ${seamFunctions.length} seam functions, all provider-aware.`);
