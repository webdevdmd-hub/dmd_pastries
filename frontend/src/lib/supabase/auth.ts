"use client";

import { AuthRateLimitError, SessionAlreadyExistsError } from "@/lib/auth/errors";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The Supabase half of the auth seam.
 *
 * Mirrors `lib/appwrite/auth` function for function, so `lib/auth/session` can
 * pick between them without either leaking upward. What is notably absent is a
 * token cache: Appwrite needed 150 lines of one to survive an hourly quota,
 * and Supabase refreshes a long-lived session in the background instead. The
 * absence is the feature.
 */

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase environment variables are missing.");
  }
  return client;
}

export function isConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * Supabase reports its own rate limiting with a 429 and a message rather than a
 * typed error, so it is recognised by shape.
 *
 * The retry window is a flat minute, unlike Appwrite's fixed hourly buckets --
 * Supabase's limits are rolling, so "wait until the top of the hour" would be
 * wrong in the other direction and just as untrue.
 */
function asRateLimitError(error: unknown): AuthRateLimitError | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const status = (error as { status?: number }).status;
  const message = ((error as { message?: string }).message ?? "").toLowerCase();

  if (status === 429 || message.includes("rate limit") || message.includes("too many requests")) {
    return new AuthRateLimitError(
      "Too many sign-in attempts from this location. Wait a minute and try again.",
      60_000,
    );
  }
  return null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = requireClient();

  // Signing in while someone else is already signed in silently replaces their
  // session. On a shared terminal that is a real hazard, so it is surfaced as
  // the same recoverable error Appwrite raises and the UI offers a choice.
  const { data: existing } = await client.auth.getSession();
  const signedInAs = existing.session?.user.email?.toLowerCase();
  if (signedInAs && signedInAs !== email.trim().toLowerCase()) {
    throw new SessionAlreadyExistsError();
  }

  const { error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    const rateLimited = asRateLimitError(error);
    if (rateLimited) {
      throw rateLimited;
    }
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  const { error } = await requireClient().auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Whether this browser holds a session, without a network call.
 *
 * Reads localStorage directly rather than awaiting getSession(), because the
 * caller uses this synchronously on boot to decide whether restoring is worth
 * attempting. An async answer here is a blank screen on every page load.
 */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (/^sb-.+-auth-token$/.test(key) && (window.localStorage.getItem(key)?.length ?? 0) > 0) {
        return true;
      }
    }
  } catch {
    // Private mode or blocked storage: no session can have been stored either.
  }
  return false;
}

/**
 * Forget the session locally, without asking Supabase.
 *
 * The fallback when sign-out cannot reach the network. A shared terminal must
 * not silently resume the previous user's session because a request failed.
 */
export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (/^sb-.+-auth-token$/.test(key)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Nothing readable means nothing to clear.
  }
}

export async function hasLiveSession(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }
  const { data } = await client.auth.getSession();
  return data.session !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export type SupabaseAccount = {
  email: string;
  emailVerified: boolean;
  name: string;
  phone: string;
};

export async function getCurrentAccount(): Promise<SupabaseAccount | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  // getUser() re-validates against the server rather than trusting the cached
  // session, so a user disabled since their last page load is not reported as
  // signed in on the strength of a token sitting in localStorage.
  const { data, error } = await client.auth.getUser();
  if (error) {
    return null;
  }

  const user = data.user;
  const metadata: Record<string, unknown> = user.user_metadata;
  return {
    email: user.email ?? "",
    emailVerified: Boolean(user.email_confirmed_at),
    // Read as a string only if it is one. user_metadata is user-writable and
    // loosely typed, so coercing blindly would put "[object Object]" on the
    // screen as somebody's name the first time it held a nested value.
    name: readString(metadata.full_name) || readString(metadata.name),
    phone: user.phone ?? "",
  };
}

/**
 * The bearer token for the backend.
 *
 * getSession() returns the cached access token and refreshes it only when it is
 * near expiry, so this is cheap enough for the per-request path it sits on.
 */
export async function getAccessToken(): Promise<string> {
  const { data, error } = await requireClient().auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("No active Supabase session.");
  }
  return token;
}

/**
 * Email verification is not driven from the client on Supabase.
 *
 * Accounts are created by the backend with email_confirm already set, because
 * an admin adding an employee has better proof of the address than a
 * confirmation email does. These exist so the seam presents one shape for both
 * providers; the UI paths that call them are Appwrite-only and go away with it.
 */
const emailVerificationUnsupported = () =>
  Promise.reject(new Error("Email verification is handled by the backend on Supabase."));

export function sendEmailVerification(_redirectUrl: string): Promise<void> {
  return emailVerificationUnsupported();
}

export function verifyEmailWithSecret(_userId: string, _secret: string): Promise<void> {
  return emailVerificationUnsupported();
}
