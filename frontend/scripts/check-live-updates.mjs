/**
 * Live updates only work if four pieces stay wired together.
 *
 * 1. invalidateRoots (what every mutation helper calls) announces the roots
 *    to the API -- without this, a change never leaves the tab that made it.
 * 2. The receiver invalidates with the *local* variant -- with the announcing
 *    one, two terminals would relay the same change back and forth forever.
 * 3. The provider is mounted -- otherwise no tab ever opens the stream.
 * 4. Focus/reconnect refetch is on -- the catch-up path for a tab that was
 *    hidden or offline, when the stream could not deliver.
 *
 * Each is a one-line change that would pass typecheck and every other test,
 * and the symptom -- "I had to refresh to see it" -- is the one this feature
 * exists to remove.
 *
 * Usage: node scripts/check-live-updates.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts) => readFileSync(join(here, "..", "src", ...parts), "utf8");

const invalidation = read("lib", "query-invalidation.ts");
const receiver = read("lib", "live-updates.ts");
const providers = read("providers", "app-providers.tsx");
const queryProvider = read("providers", "query-provider.tsx");

const failures = [];

const roots = invalidation.slice(invalidation.indexOf("export function invalidateRoots("));
const rootsBody = roots.slice(0, roots.indexOf("\n}"));
if (!/broadcastChanged\(roots\)/.test(rootsBody)) {
  failures.push(
    "invalidateRoots no longer announces to the API -- changes stay on the tab that made them",
  );
}
if (!/^import \{ broadcastChanged \} from "@\/lib\/live-broadcast";/m.test(invalidation)) {
  failures.push("query-invalidation does not import broadcastChanged");
}

if (!/invalidateRootsLocal\(queryClient, roots\)/.test(receiver)) {
  failures.push("the live-updates receiver does not use invalidateRootsLocal");
}
if (/\binvalidateRoots\(/.test(receiver)) {
  failures.push(
    "the receiver calls the announcing invalidateRoots -- two terminals would ping-pong forever",
  );
}
if (!/event !== "changed"/.test(receiver)) {
  failures.push("the receiver no longer filters on the `changed` event name");
}

if (!/<LiveUpdatesProvider \/>/.test(providers)) {
  failures.push("LiveUpdatesProvider is not mounted in app-providers.tsx");
}

if (!/refetchOnWindowFocus: true/.test(queryProvider)) {
  failures.push("refetchOnWindowFocus is not true -- a hidden tab never catches up");
}
if (!/refetchOnReconnect: true/.test(queryProvider)) {
  failures.push("refetchOnReconnect is not true -- a terminal that lost wifi never catches up");
}

if (failures.length > 0) {
  console.error("Live updates guard failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(
  "  Live updates OK: mutations announce, the receiver stays local, provider mounted, focus refetch on.",
);
