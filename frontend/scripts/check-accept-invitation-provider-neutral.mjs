/**
 * Accepting an invitation must not require an Appwrite id.
 *
 * The backend creates the account, commits, and answers with whichever
 * provider id it has. On a Supabase-only deployment appwrite_user_id is an
 * empty string. The parser used to reject that reply as "missing required
 * fields" -- after the account already existed -- so the new employee saw an
 * error for a sign-up that had worked, and had to guess they could log in.
 *
 * The other parsers (users, branches, auth, super-admin) were made
 * provider-neutral during the migration; this one was missed, and nothing
 * caught it because no test walked the accept path. This does.
 *
 * Usage: node scripts/check-accept-invitation-provider-neutral.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src", "lib", "api", "invitations.ts"), "utf8");

const start = source.indexOf("function parseAcceptStaffInvitationResult(");
const end = source.indexOf("\n}", start);
const body = start >= 0 ? source.slice(start, end) : "";

const failures = [];

if (!body) {
  failures.push("parseAcceptStaffInvitationResult is missing");
}
if (/!appwriteUserId\s*\|\|/.test(body) || /\|\|\s*!appwriteUserId/.test(body)) {
  failures.push("the accept parser still requires appwriteUserId on its own");
}
if (!/result\.supabase_user_id/.test(body)) {
  failures.push("the accept parser never reads supabase_user_id");
}
if (!/appwriteUserId !== "" \|\| supabaseUserId !== null/.test(body)) {
  failures.push("the accept parser does not accept either provider id as proof of creation");
}

if (failures.length > 0) {
  console.error("Accept-invitation provider guard failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("  Accept invitation OK: either provider id is accepted.");
