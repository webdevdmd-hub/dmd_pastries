"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnvValue } from "@/lib/public-env";

/**
 * The Supabase client, for authentication only.
 *
 * It is never used to read or write application data. Every table lives in a
 * schema with no RLS policies and 1,089 tenant predicates that exist only in
 * the Go API, so a query issued from the browser would either be denied or --
 * worse, if the Data API were ever reopened -- return another bakery's books.
 * Data goes through the Go API, always. `scripts/check-auth-provider-seam.mjs`
 * enforces that nothing outside this directory even imports the SDK.
 */
let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getPublicEnvValue("NEXT_PUBLIC_SUPABASE_URL") &&
    getPublicEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

/**
 * Returns the shared client, or null when Supabase is not configured.
 *
 * Null rather than a throw: before cutover the environment is deliberately
 * empty, and the seam treats "not configured" as "not my provider" and falls
 * through to Appwrite. Throwing here would turn an expected state into a crash
 * on every page load.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const url = getPublicEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getPublicEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return null;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      // The session lives in localStorage and is refreshed in the background,
      // which is the whole reason the Appwrite JWT cache can be deleted: there
      // is no per-hour token quota to work around, and a reopened tab resumes
      // rather than minting anything.
      persistSession: true,
      autoRefreshToken: true,
      storageKey: supabaseStorageKey(url),

      // The reset link carries its proof in the query string, which this app
      // reads server-side. Letting the SDK also scan the URL would have it
      // racing the reset page for a single-use token, and whichever lost would
      // report an invalid link.
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

/**
 * The localStorage key for this project's session.
 *
 * Derived from the project ref rather than left to the SDK's default so that
 * `purgeInactiveProviderState` can find and clear it by pattern. Two systems
 * needing to agree on a key name is exactly where a default drifts unnoticed.
 */
function supabaseStorageKey(url: string): string {
  const ref = url.replace(/^https?:\/\//, "").split(".")[0] ?? "project";
  return `sb-${ref}-auth-token`;
}

/** Only for tests, which need a clean client per case. */
export function resetSupabaseClientForTests(): void {
  cachedClient = null;
}
