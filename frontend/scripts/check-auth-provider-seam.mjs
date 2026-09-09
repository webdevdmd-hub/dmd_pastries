/**
 * Only the seam may import an identity provider.
 *
 * `lib/auth/session.ts` exists so the app deals in sessions and accounts rather
 * than in Appwrite or Supabase, which is what makes the migration's cutover a
 * pair of environment variables instead of a redeploy of application logic.
 *
 * That property survives exactly as long as nobody reaches around it. And the
 * pull is real: `createAppwriteJwt` is right there, autocomplete offers it, and
 * one import in a new component is enough to pin a file to a provider that is
 * being removed. Nothing would fail — until the cutover, when that one call
 * site keeps minting Appwrite tokens for a backend that has moved on, and the
 * symptom is one screen mysteriously 401ing.
 *
 * Allowed to import a provider:
 *   - src/lib/auth/*      the seam itself
 *   - src/lib/appwrite/*  the Appwrite implementation
 *   - src/lib/supabase/*  the Supabase implementation, once it exists
 *
 * Storage is deliberately out of scope: it is a separate migration phase and
 * still calls Appwrite directly by design.
 *
 * Usage: node scripts/check-auth-provider-seam.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "..", "src");

const IMPLEMENTATION_DIRS = [
  join("lib", "auth"),
  join("lib", "storage"),
  join("lib", "appwrite"),
  join("lib", "supabase"),
];

// Auth and storage both have seams now, so neither provider module may be
// imported directly from outside lib/.
const FORBIDDEN_IMPORTS = [
  { pattern: /@\/lib\/appwrite\/auth/, name: "@/lib/appwrite/auth" },
  { pattern: /@\/lib\/appwrite\/client/, name: "@/lib/appwrite/client" },
  { pattern: /@\/lib\/supabase\/auth/, name: "@/lib/supabase/auth" },
  { pattern: /@\/lib\/supabase\/client/, name: "@/lib/supabase/client" },
  { pattern: /@\/lib\/appwrite\/storage/, name: "@/lib/appwrite/storage" },
  { pattern: /@\/lib\/supabase\/storage/, name: "@/lib/supabase/storage" },
  { pattern: /from "appwrite"/, name: "the appwrite SDK" },
  { pattern: /from "@supabase\/supabase-js"/, name: "the supabase SDK" },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];

for (const file of walk(srcDir)) {
  const relativePath = relative(srcDir, file);
  if (IMPLEMENTATION_DIRS.some((allowed) => relativePath.startsWith(allowed + sep))) {
    continue;
  }

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { pattern, name } of FORBIDDEN_IMPORTS) {
      if (pattern.test(line)) {
        offenders.push({ file: relativePath, imported: name, line: index + 1 });
      }
    }
  });
}

if (offenders.length > 0) {
  console.error("\n  Auth provider seam FAILED.");
  console.error("  These files reach past lib/auth/session and bind themselves to one provider:\n");
  for (const { file, line, imported } of offenders) {
    console.error(`    ${file}:${line}  imports ${imported}`);
  }
  console.error(
    "\n  Import from @/lib/auth/session instead. If the seam is missing something\n" +
      "  you need, add it there -- that is the file whose job is to know which\n" +
      "  provider is live, and the only one that should change at cutover.\n",
  );
  process.exit(1);
}

console.log("  Auth provider seam OK: only lib/auth and the provider modules import a provider.");
