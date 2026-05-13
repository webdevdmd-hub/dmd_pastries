"use client";

import type { Models } from "appwrite";

import { appwriteAccount, getAppwriteProjectId, isAppwriteConfigured } from "@/lib/appwrite/client";

function requireAccount() {
  if (!isAppwriteConfigured() || !appwriteAccount) {
    throw new Error("Appwrite environment variables are missing.");
  }

  return appwriteAccount;
}

type CachedJwt = {
  expiresAt: number;
  jwt: string;
};

let cachedJwt: CachedJwt | null = null;

export class AppwriteSessionAlreadyExistsError extends Error {
  constructor(message = "An Appwrite session is already active in this browser.") {
    super(message);
    this.name = "AppwriteSessionAlreadyExistsError";
  }
}

export class AppwriteRateLimitError extends Error {
  constructor(
    message = "Appwrite rate limit has been exceeded. Please wait a moment before trying again.",
  ) {
    super(message);
    this.name = "AppwriteRateLimitError";
  }
}

export async function loginWithAppwrite(email: string, password: string): Promise<void> {
  const account = requireAccount();
  clearCachedAppwriteJwt();

  try {
    await account.createEmailPasswordSession(email, password);
  } catch (error) {
    if (isAppwriteRateLimitError(error)) {
      throw new AppwriteRateLimitError();
    }

    if (!isAppwriteErrorType(error, "user_session_already_exists")) {
      throw new Error(`Unable to create an Appwrite session. ${getAppwriteErrorMessage(error)}`);
    }

    throw new AppwriteSessionAlreadyExistsError();
  }

  await account.get();
}

export async function logoutFromAppwrite(): Promise<void> {
  clearCachedAppwriteJwt();
  await requireAccount().deleteSession("current");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAppwriteErrorType(error: unknown, type: string): boolean {
  return isObject(error) && error.type === type;
}

export function hasStoredAppwriteSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const currentProjectId = getAppwriteProjectId();

  if (!currentProjectId) {
    return false;
  }

  const fallbackCookies = window.localStorage.getItem("cookieFallback");

  if (!fallbackCookies) {
    return false;
  }

  try {
    const parsed = JSON.parse(fallbackCookies) as unknown;

    if (!isObject(parsed)) {
      return false;
    }

    const sessionValue = parsed[`a_session_${currentProjectId}`];
    return typeof sessionValue === "string" && sessionValue.length > 0;
  } catch {
    return false;
  }
}

export async function getCurrentAppwriteAccount(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await requireAccount().get();
  } catch {
    return null;
  }
}

export async function getCurrentAppwriteSession(): Promise<Models.Session | null> {
  try {
    return await requireAccount().getSession("current");
  } catch {
    return null;
  }
}

export async function createAppwriteJwt(): Promise<string> {
  if (cachedJwt && cachedJwt.expiresAt - Date.now() > 60_000) {
    return cachedJwt.jwt;
  }

  try {
    const jwt = await requireAccount().createJWT();
    cachedJwt = {
      jwt: jwt.jwt,
      expiresAt: resolveJwtExpiry(jwt.jwt),
    };
    return jwt.jwt;
  } catch (error) {
    if (isAppwriteRateLimitError(error)) {
      throw new AppwriteRateLimitError(
        "Unable to create an Appwrite JWT for login sync. Rate limit for the current endpoint has been exceeded. Please wait a moment before trying again.",
      );
    }

    const message = getAppwriteErrorMessage(error);
    throw new Error(`Unable to create an Appwrite JWT for login sync. ${message}`);
  }
}

export function clearCachedAppwriteJwt(): void {
  cachedJwt = null;
}

function resolveJwtExpiry(jwt: string): number {
  const fallbackExpiry = Date.now() + 10 * 60_000;
  const [, payload] = jwt.split(".");

  if (!payload) {
    return fallbackExpiry;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decodedPayload = JSON.parse(atob(paddedPayload)) as unknown;

    if (!isObject(decodedPayload) || typeof decodedPayload.exp !== "number") {
      return fallbackExpiry;
    }

    return decodedPayload.exp * 1000;
  } catch {
    return fallbackExpiry;
  }
}

function isAppwriteRateLimitError(error: unknown): boolean {
  if (!isObject(error)) {
    return error instanceof Error && error.message.toLowerCase().includes("rate limit");
  }

  const code = error.code;
  const type = error.type;
  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    code === 429 ||
    type === "general_rate_limit_exceeded" ||
    type === "rate_limit_exceeded" ||
    message.includes("rate limit")
  );
}

function getAppwriteErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
    return "The browser could not reach Appwrite. Verify the frontend domain is added as a Web platform in Appwrite and the Appwrite endpoint is reachable.";
  }

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Appwrite did not return a readable error message.";
}

export async function sendEmailVerification(redirectUrl: string): Promise<void> {
  await requireAccount().createVerification(redirectUrl);
}

export async function verifyEmailWithSecret(userId: string, secret: string): Promise<void> {
  await requireAccount().updateVerification(userId, secret);
}
