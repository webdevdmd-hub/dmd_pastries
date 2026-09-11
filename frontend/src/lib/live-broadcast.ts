"use client";

import { getApiBaseUrl } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

/**
 * The sending half of live updates, kept apart from the receiving half so
 * query-invalidation can import it without an import cycle: invalidation
 * announces, live-updates listens, and neither needs the other at load time.
 */

const clientIDStorageKey = "pastries-pos.live-updates.client-id";

/** Stable per tab, so the API can avoid echoing a tab's own changes back. */
export function liveClientID(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const existing = window.sessionStorage.getItem(clientIDStorageKey);
    if (existing) {
      return existing;
    }
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(clientIDStorageKey, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

let pendingRoots = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue roots to announce. Coalesced over a short window: one form submit
 * often invalidates ten roots through three helpers, and that should be one
 * request, not three.
 */
export function broadcastChanged(roots: readonly string[]): void {
  if (typeof window === "undefined" || roots.length === 0) {
    return;
  }
  for (const root of roots) {
    pendingRoots.add(root);
  }
  if (flushTimer !== null) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = Array.from(pendingRoots);
    pendingRoots = new Set();
    void sendChanged(batch);
  }, 150);
}

async function sendChanged(roots: string[]): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return;
    }
    await fetch(`${getApiBaseUrl()}/api/v1/events/changed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Client-Id": liveClientID(),
      },
      body: JSON.stringify({ roots }),
      keepalive: true,
    });
  } catch {
    // Best effort. The local invalidation already happened; the other tabs
    // catch up on their next focus or reconnect.
  }
}
