/**
 * The reset page must accept either provider's link.
 *
 * Appwrite emails `?userId=...&secret=...`; Supabase emails a single-use token,
 * named `token_hash` by its current templates. Both have to work at once, and
 * for longer than the cutover itself: a reset email sent at 08:00 is clicked at
 * 08:20, and if the deploy landed in between, the link must still work. People
 * do not re-request a password reset because it failed once -- they conclude
 * the product is broken and telephone.
 *
 * The failure this guards is silent in the worst way. Requiring Appwrite's pair
 * would reject every Supabase link with "Invalid reset link", which reads as a
 * broken product rather than a configuration mismatch, and would only be
 * discovered by a locked-out employee.
 *
 * Usage: node scripts/check-password-reset-link.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, "..", path), "utf8");

const failures = [];

const page = read("src/app/(auth)/reset-password/page.tsx");
const form = read("src/components/auth/reset-password-form.tsx");
const schema = read("src/validators/auth.schema.ts");
const api = read("src/lib/api/auth.ts");

// The page has to read Supabase's parameter off the query string at all.
if (!page.includes("token_hash")) {
  failures.push(
    "the reset page does not read token_hash; every Supabase reset link would " +
      "arrive with no proof and be rejected as invalid",
  );
}

// Appwrite's shape must survive: links already in inboxes still use it.
if (!page.includes("userId") || !page.includes("secret")) {
  failures.push(
    "the reset page stopped reading userId/secret; Appwrite links already sent " +
      "would break, including ones sent minutes before the cutover",
  );
}

// The gate that decides whether the form even renders.
const validity = form.match(/const linkIsValid = .*/)?.[0] ?? "";
if (!validity.includes("token")) {
  failures.push(
    `the form's link-validity check ignores the token: ${validity.trim() || "(not found)"}`,
  );
}
if (!/\|\|/.test(validity)) {
  failures.push(
    "the form requires BOTH providers' proof rather than either; one provider's " +
      "links would always be rejected",
  );
}

// The schema must not make one provider's fields mandatory.
const resetSchema = schema.slice(schema.indexOf("export const resetPasswordSchema"));
if (
  /userId: z\.string\(\)\.min\(1/.test(resetSchema) ||
  /secret: z\.string\(\)\.min\(1/.test(resetSchema)
) {
  failures.push(
    "the schema still requires userId/secret, which rejects Supabase links before " +
      "they reach the backend",
  );
}
if (!resetSchema.includes("token")) {
  failures.push("the schema has no token field, so it would be stripped before submission");
}

// And it must still reject a link carrying neither proof.
if (!/token\.length > 0 \|\|/.test(resetSchema)) {
  failures.push(
    "the schema no longer rejects a link carrying neither proof; a bare " +
      "/reset-password visit would submit a password change with nothing " +
      "authorising it",
  );
}

// The token has to actually reach the backend.
if (!api.includes("token: input.token")) {
  failures.push(
    "the API layer does not send the token; the backend would receive a reset " +
      "request with no proof and refuse it",
  );
}

if (failures.length > 0) {
  console.error("\n  Password reset link FAILED.\n");
  for (const failure of failures) {
    console.error(`    - ${failure}`);
  }
  console.error(
    "\n  Both providers' links must work simultaneously for as long as both are\n" +
      "  live. Reset emails outlive the deploy that sent them.\n",
  );
  process.exit(1);
}

console.log("  Password reset link OK: both Appwrite and Supabase links are accepted.");
