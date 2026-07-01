"use client";

import type { Models } from "appwrite";

import { appwriteAccount, getAppwriteProjectId, isAppwriteConfigured } from "@/lib/appwrite/client";
import { getPublicEnvValue } from "@/lib/public-env";

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
let jwtRequestPromise: Promise<string> | null = null;
let jwtRateLimitUntil = 0;

const e2eSessionKey = "pastries-pos:e2e-session";
const jwtRateLimitCooldownMs = 60_000;
const jwtRateLimitMessage =
  "Unable to create an Appwrite JWT for login sync. Rate limit for the current endpoint has been exceeded. Wait 60 seconds, then continue the existing session.";

export class AppwriteSessionAlreadyExistsError extends Error {
  constructor(message = "An Appwrite session is already active in this browser.") {
    super(message);
    this.name = "AppwriteSessionAlreadyExistsError";
  }
}

export class AppwriteRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(
    message = "Appwrite rate limit has been exceeded. Please wait a moment before trying again.",
    retryAfterMs = jwtRateLimitCooldownMs,
  ) {
    super(message);
    this.name = "AppwriteRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export async function loginWithAppwrite(email: string, password: string): Promise<void> {
  if (isE2EAuthEnabled()) {
    clearCachedAppwriteJwt();
    setE2ESession();
    return;
  }

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
  if (isE2EAuthEnabled()) {
    clearE2ESession();
    return;
  }

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

  if (isE2EAuthEnabled()) {
    return hasE2ESession();
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
  if (isE2EAuthEnabled()) {
    return hasE2ESession() ? buildE2EAccount() : null;
  }

  try {
    return await requireAccount().get();
  } catch {
    return null;
  }
}

export async function getCurrentAppwriteSession(): Promise<Models.Session | null> {
  if (isE2EAuthEnabled()) {
    return hasE2ESession() ? buildE2ESession() : null;
  }

  try {
    return await requireAccount().getSession("current");
  } catch {
    return null;
  }
}

export async function createAppwriteJwt(): Promise<string> {
  if (isE2EAuthEnabled()) {
    return getE2EAuthToken();
  }

  if (cachedJwt && cachedJwt.expiresAt - Date.now() > 60_000) {
    return cachedJwt.jwt;
  }

  const cooldownRemainingMs = getJwtRateLimitRemainingMs();
  if (cooldownRemainingMs > 0) {
    throw new AppwriteRateLimitError(jwtRateLimitMessage, cooldownRemainingMs);
  }

  if (jwtRequestPromise) {
    return jwtRequestPromise;
  }

  jwtRequestPromise = createFreshAppwriteJwt();

  try {
    return await jwtRequestPromise;
  } finally {
    jwtRequestPromise = null;
  }
}

async function createFreshAppwriteJwt(): Promise<string> {
  try {
    const jwt = await requireAccount().createJWT();
    cachedJwt = {
      jwt: jwt.jwt,
      expiresAt: resolveJwtExpiry(jwt.jwt),
    };
    jwtRateLimitUntil = 0;
    return jwt.jwt;
  } catch (error) {
    if (isAppwriteRateLimitError(error)) {
      jwtRateLimitUntil = Date.now() + jwtRateLimitCooldownMs;
      throw new AppwriteRateLimitError(jwtRateLimitMessage, jwtRateLimitCooldownMs);
    }

    const message = getAppwriteErrorMessage(error);
    throw new Error(`Unable to create an Appwrite JWT for login sync. ${message}`);
  }
}

export function clearCachedAppwriteJwt(): void {
  cachedJwt = null;
  jwtRequestPromise = null;
}

export function getJwtRateLimitRemainingMs(): number {
  return Math.max(0, jwtRateLimitUntil - Date.now());
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
  if (isE2EAuthEnabled()) {
    return;
  }

  await requireAccount().createVerification(redirectUrl);
}

export async function verifyEmailWithSecret(userId: string, secret: string): Promise<void> {
  if (isE2EAuthEnabled()) {
    return;
  }

  await requireAccount().updateVerification(userId, secret);
}

function isE2EAuthEnabled(): boolean {
  return (
    getPublicEnvValue("NEXT_PUBLIC_E2E_AUTH_ENABLED") === "true" && getE2EAuthToken().length > 0
  );
}

function getE2EAuthToken(): string {
  return getPublicEnvValue("NEXT_PUBLIC_E2E_AUTH_TOKEN") ?? "";
}

function setE2ESession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(e2eSessionKey, "active");
}

function clearE2ESession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(e2eSessionKey);
}

function hasE2ESession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(e2eSessionKey) === "active";
}

function buildE2EAccount(): Models.User<Models.Preferences> {
  return {
    $id: "e2e-owner",
    $createdAt: new Date(0).toISOString(),
    $updatedAt: new Date(0).toISOString(),
    accessedAt: new Date(0).toISOString(),
    email: "owner.e2e@pastries.local",
    emailVerification: true,
    labels: [],
    mfa: false,
    name: "E2E Owner",
    passwordUpdate: "",
    phone: "+971500000000",
    phoneVerification: true,
    prefs: {},
    registration: new Date(0).toISOString(),
    status: true,
    targets: [],
  };
}

function buildE2ESession(): Models.Session {
  return {
    $id: "e2e-session",
    $createdAt: new Date(0).toISOString(),
    $updatedAt: new Date(0).toISOString(),
    clientCode: "",
    clientEngine: "",
    clientEngineVersion: "",
    clientName: "Codex E2E",
    clientType: "browser",
    clientVersion: "",
    countryCode: "AE",
    countryName: "United Arab Emirates",
    current: true,
    deviceBrand: "",
    deviceModel: "",
    deviceName: "",
    expire: new Date(Date.now() + 60 * 60_000).toISOString(),
    factors: ["password"],
    ip: "127.0.0.1",
    mfaUpdatedAt: "",
    osCode: "",
    osName: "Windows",
    osVersion: "",
    provider: "email",
    providerAccessToken: "",
    providerAccessTokenExpiry: "",
    providerRefreshToken: "",
    providerUid: "e2e-owner",
    secret: "",
    userId: "e2e-owner",
  };
}
