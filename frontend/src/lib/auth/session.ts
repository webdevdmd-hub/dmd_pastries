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
