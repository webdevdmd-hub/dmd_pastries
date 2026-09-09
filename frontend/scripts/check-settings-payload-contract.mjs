/**
 * Every field the company-settings screen sends must exist on the API.
 *
 * This guards a failure with no symptom. Go's JSON decoding ignores fields the
 * target struct does not have, so a payload key that matches nothing is dropped
 * in silence: the request succeeds, the response is 200, and the value simply
 * never persists. Nothing logs, nothing throws, and the screen looks like it
 * saved.
 *
 * That is not hypothetical. The company logo was sent as `logo_url` for as long
 * as the settings API has existed, and the backend has no `logo_url` field in
 * either direction -- the string appears nowhere in the Go code. So the logo
 * could not be saved and could not be displayed, while the upload succeeded and
 * the preview showed the freshly chosen file. It survived that long precisely
 * because every layer reported success.
 *
 * TypeScript cannot catch it: both sides were internally consistent, and the
 * frontend's idea of the backend's shape is a hand-written interface that
 * agreed with itself.
 *
 * Scoped to company settings rather than every payload in the app. A general
 * version would be worth having and is a bigger piece of work; this covers the
 * one that actually broke, and the comment above says what to widen it to.
 *
 * Usage: node scripts/check-settings-payload-contract.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dtoPath = resolve(here, "..", "..", "backend", "internal", "modules", "settings", "dto.go");
const apiPath = join(here, "..", "src", "lib", "api", "settings-data.ts");

/** The json tag names on one Go struct. */
function jsonTagsOf(source, structName) {
  const start = source.indexOf(`type ${structName} struct {`);
  if (start === -1) {
    return null;
  }
  const end = source.indexOf("\n}", start);
  const body = source.slice(start, end);

  const tags = new Set();
  for (const match of body.matchAll(/json:"([^",]+)/g)) {
    tags.add(match[1]);
  }
  return tags;
}

/** The keys of the object literal returned by a function. */
function payloadKeysOf(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) {
    return null;
  }
  const open = source.indexOf("return {", start);
  const close = source.indexOf("\n  };", open);
  const body = source.slice(open, close);

  const keys = new Set();
  for (const match of body.matchAll(/^\s{4}([a-z0-9_]+):/gm)) {
    keys.add(match[1]);
  }
  return keys;
}

const dtoSource = readFileSync(dtoPath, "utf8");
const apiSource = readFileSync(apiPath, "utf8");

const accepted = jsonTagsOf(dtoSource, "UpdateCompanySettingsRequest");
const sent = payloadKeysOf(apiSource, "toBackendCompanySettingsPayload");

if (!accepted || accepted.size === 0) {
  console.error(
    "\n  Settings payload contract FAILED.\n" +
      "  Could not read UpdateCompanySettingsRequest from the backend DTO.\n" +
      "  If that struct was renamed, update this script -- do not delete the check.\n",
  );
  process.exit(1);
}
if (!sent || sent.size === 0) {
  console.error(
    "\n  Settings payload contract FAILED.\n" +
      "  Could not read the keys of toBackendCompanySettingsPayload.\n" +
      "  If it was renamed or reshaped, update this script -- do not delete the check.\n",
  );
  process.exit(1);
}

const orphans = [...sent].filter((key) => !accepted.has(key));

if (orphans.length > 0) {
  console.error("\n  Settings payload contract FAILED.");
  console.error("  These fields are sent to the API, which has no field for them:\n");
  for (const key of orphans) {
    console.error(`    ${key}`);
  }
  console.error(
    "\n  Go drops unknown JSON fields without error, so the request will return\n" +
      "  200 and the value will never be saved. Add the field to\n" +
      "  UpdateCompanySettingsRequest in backend/internal/modules/settings/dto.go,\n" +
      "  or stop sending it.\n",
  );
  process.exit(1);
}

console.log(
  `  Settings payload contract OK: all ${sent.size} fields sent are accepted by the API.`,
);
