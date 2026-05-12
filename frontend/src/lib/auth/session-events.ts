"use client";

export const AUTH_SESSION_EXPIRED_EVENT = "pastries-pos:auth-session-expired";

export function notifySessionExpired(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, callback);

  return () => {
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, callback);
  };
}
