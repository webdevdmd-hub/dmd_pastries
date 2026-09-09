"use client";

/**
 * The one place the app talks to an identity provider.
 *
 * Everything above this file — the auth provider, the login form, the API
 * client — deals in sessions and accounts, not in Appwrite or Supabase. That
 * matters during the migration for a specific reason: the backend verifies
 * BOTH providers' tokens at once, so the cutover is a pair of environment
 * variables flipping together (NEXT_PUBLIC_AUTH_PROVIDER here,
 * AUTH_PRIMARY_PROVIDER on the server) and the rollback is flipping them back.
 * No redeploy of application logic, no data restore.
 *
 * The seam is deliberately narrow. Only four files imported the Appwrite module
 * directly, and none of them ever touched an Appwrite SDK type, so nothing
 * above here has to change again when the implementation swaps.
 */

import {
  clearCachedAppwriteJwt,
  clearStoredAppwriteSession,
  createAppwriteJwt,
  getCurrentAppwriteAccount,
  getCurrentAppwriteSession,
  hasStoredAppwriteSession,
  loginWithAppwrite,
  logoutFromAppwrite,
  sendEmailVerification as sendAppwriteEmailVerification,
  verifyEmailWithSecret as verifyAppwriteEmailWithSecret,
} from "@/lib/appwrite/auth";
import { getPublicEnvValue } from "@/lib/public-env";

export { AuthRateLimitError, SessionAlreadyExistsError } from "@/lib/auth/errors";

export type AuthProviderName = "appwrite" | "supabase";

/**
 * The signed-in person, in the shape this app actually uses.
 *
 * Note what is absent: no provider id, no raw token, no session object. The
 * local `users` row is the authority on who someone is and what they may do —
 * the provider only vouches that they are who they say. Passing more of the
 * provider's payload upward is how that boundary erodes.
 */
export type AuthAccount = {
  email: string;
  emailVerified: boolean;
  name: string;
  phone: string;
};

/**
 * Which provider issues sessions in this build.
 *
 * Defaults to Appwrite so an unconfigured deployment behaves exactly as it did
 * before this file existed. The migration is opt-in, per environment.
 */
export function activeAuthProvider(): AuthProviderName {
  return getPublicEnvValue("NEXT_PUBLIC_AUTH_PROVIDER") === "supabase" ? "supabase" : "appwrite";
}

/**
 * Local storage belonging to whichever provider is not in charge.
 *
 * Appwrite keeps its session in `cookieFallback` and its cached token under the
 * two `pastries-pos:appwrite-*` keys. Supabase keeps its session under
 * `sb-<project ref>-auth-token`, matched by pattern rather than by name so this
 * does not silently stop working if the project ref changes.
 */
const APPWRITE_LOCAL_KEYS = [
  "cookieFallback",
  "pastries-pos:appwrite-jwt",
  "pastries-pos:appwrite-jwt-rate-limit-until",
];
const SUPABASE_SESSION_KEY = /^sb-.+-auth-token$/;

/**
 * Clear the credentials of the provider that is not currently in charge.
 *
 * Every terminal that was signed in before the cutover still holds an Appwrite
 * session, and it does not disappear on its own. Left in place, a browser
 * carries two sets of credentials and the answer to "is this person signed in"
 * depends on which one you ask -- a half-authenticated state that reproduces
 * only on the machines that were working yesterday, which is the hardest kind
 * to debug and the most likely to appear at 7am on the register.
 *
 * Rolling back costs those terminals one sign-in. That is the right trade: a
 * pre-cutover session silently resurrecting is worse than a login prompt,
 * because the session it resurrects may belong to someone since deactivated.
 */
export function purgeInactiveProviderState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const supabaseIsActive = activeAuthProvider() === "supabase";

    if (supabaseIsActive) {
      for (const key of APPWRITE_LOCAL_KEYS) {
        window.localStorage.removeItem(key);
      }
      return;
    }

    for (const key of Object.keys(window.localStorage)) {
      if (SUPABASE_SESSION_KEY.test(key)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Private mode or blocked storage. Nothing to purge, and nothing that
    // reads these keys will find anything either.
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  return loginWithAppwrite(email, password);
}

export async function signOut(): Promise<void> {
  return logoutFromAppwrite();
}

/**
 * Whether this browser holds credentials, without asking the network.
 *
 * Used on boot to decide whether restoring a session is even worth attempting,
 * so it has to be synchronous and cheap: a slow answer here is a blank screen
 * on every page load.
 */
export function hasStoredSession(): boolean {
  return hasStoredAppwriteSession();
}

/**
 * Forget this browser's credentials locally.
 *
 * Separate from signOut() because it is the fallback when the provider cannot
 * be reached: a shared terminal must not silently resume the previous user's
 * session just because the sign-out request failed.
 */
export function clearStoredSession(): void {
  clearStoredAppwriteSession();
}

/** Whether the provider still considers this browser's session live. */
export async function hasLiveSession(): Promise<boolean> {
  return (await getCurrentAppwriteSession()) !== null;
}

export async function getCurrentAccount(): Promise<AuthAccount | null> {
  const account = await getCurrentAppwriteAccount();
  if (!account) {
    return null;
  }

  return {
    email: account.email,
    emailVerified: account.emailVerification,
    name: account.name,
    phone: account.phone,
  };
}

/**
 * A bearer token for the backend.
 *
 * Every authenticated API call goes through here, so it must stay cheap:
 * implementations cache and reuse rather than minting per request.
 */
export async function getAccessToken(): Promise<string> {
  return createAppwriteJwt();
}

/** Drop the cached token, so the next call mints a fresh one. */
export function clearCachedAccessToken(): void {
  clearCachedAppwriteJwt();
}

export async function sendEmailVerification(redirectUrl: string): Promise<void> {
  return sendAppwriteEmailVerification(redirectUrl);
}

export async function verifyEmailWithSecret(userId: string, secret: string): Promise<void> {
  return verifyAppwriteEmailWithSecret(userId, secret);
}
