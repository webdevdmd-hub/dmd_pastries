"use client";

import type { QueryClient } from "@tanstack/react-query";

import { getApiBaseUrl } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { liveClientID } from "@/lib/live-broadcast";
import { invalidateRootsLocal, isQueryRoot, type QueryRoot } from "@/lib/query-invalidation";

/**
 * Live updates: how a change on one terminal reaches the others.
 *
 * Every mutation in this app already invalidates the query roots it touches,
 * so the tab that made the change refreshes itself. What was missing is the
 * other tabs -- a sale rung on terminal B, a product edited in the office, a
 * staff member asking for a reset. They only learned about it on reload.
 *
 * The API keeps one open stream per tab (Server-Sent Events). After a tab
 * invalidates locally it also posts the same root list to the API, which
 * relays it to the business's other tabs; each of those invalidates the same
 * roots and TanStack Query refetches whatever is on screen. The roots are the
 * message; no data travels this channel.
 *
 * fetch() rather than EventSource, because EventSource cannot send the
 * Authorization header and the stream sits behind the ordinary auth guard.
 */

// ---------------------------------------------------------------------------
// Receive (API -> this tab)
// ---------------------------------------------------------------------------

type ChangedPayload = { roots?: unknown };

function rootsFrom(data: string): QueryRoot[] {
  try {
    const parsed = JSON.parse(data) as ChangedPayload;
    if (!Array.isArray(parsed.roots)) {
      return [];
    }
    return parsed.roots.filter(isQueryRoot);
  } catch {
    return [];
  }
}

/**
 * Keep a stream open for as long as the signal lives. Reconnects with backoff
 * on any drop (network blip, deploy, proxy timeout), and on reconnect refetches
 * everything on screen -- whatever happened while disconnected is unknown, so
 * assume it all did.
 */
export async function runLiveUpdates(queryClient: QueryClient, signal: AbortSignal): Promise<void> {
  let attempt = 0;
  let everConnected = false;

  while (!signal.aborted) {
    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("no access token");
      }
      const response = await fetch(`${getApiBaseUrl()}/api/v1/events/stream`, {
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          "X-Client-Id": liveClientID(),
        },
        cache: "no-store",
        signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`stream refused: ${String(response.status)}`);
      }

      attempt = 0;
      if (everConnected) {
        await queryClient.invalidateQueries({ refetchType: "active" });
      }
      everConnected = true;

      await readEvents(response.body, (event, data) => {
        if (event !== "changed") {
          return;
        }
        const roots = rootsFrom(data);
        if (roots.length > 0) {
          void invalidateRootsLocal(queryClient, roots);
        }
      });
    } catch {
      // Fall through to the reconnect delay unless we were told to stop.
    }

    if (isAborted(signal)) {
      return;
    }
    attempt += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
    await sleep(delay, signal);
  }
}

/** Minimal SSE parser: `event:` and `data:` lines, blank line ends a message. */
async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let data: string[] = [];

  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      if (line === "") {
        if (data.length > 0) {
          onEvent(event, data.join("\n"));
        }
        event = "message";
        data = [];
      } else if (line.startsWith(":")) {
        // Comment / heartbeat.
      } else if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).trimStart());
      }
    }
  }
}

// A function rather than reading .aborted inline: after the awaits above the
// type checker still believes the flag is the value it saw at loop entry.
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish(): void {
      signal.removeEventListener("abort", finish);
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}
