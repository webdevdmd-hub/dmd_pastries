"use client";

import type { JSX } from "react";

import { useConnectivity } from "@/components/connectivity/connectivity-provider";
import { Button } from "@/components/ui/button";

/**
 * Persistent offline notice for the Counter register (E5).
 *
 * Design rules it implements, from docs/design/preview-states.html:
 *
 * - NOT DISMISSABLE. A dismissable offline warning is one that gets dismissed at
 *   the start of a rush, which is precisely when it matters.
 * - Says what it means for the cashier, not what it is. "Offline" is the system's
 *   word; "Sales can't be completed" is the one that changes behaviour.
 * - Dot plus text, never colour alone.
 * - Promises the cart. "Nothing is lost" is the difference between a cashier
 *   waiting and a cashier re-ringing eight items they still have.
 * - Manual, visible retry. A silent background retry leaves them guessing.
 *
 * It renders nothing when online, so it costs no layout when it does not apply.
 * Placed inside the counter layout rather than a route, so it survives navigation.
 */
export function OfflineBar(): JSX.Element | null {
  const { isOffline, isRechecking, reason, recheck } = useConnectivity();

  if (!isOffline) {
    return null;
  }

  // Two distinct causes, two accurate messages. Telling a cashier "check your
  // connection" when the wifi is fine and the server is down sends them to fix
  // the wrong thing.
  // One sentence, not three spans. At 1024px — the counter viewport — a separate
  // "nothing is lost" span pushed Retry off the edge, so the reassurance is folded
  // in here. It has to stay: "the sale is safe" is what stops a cashier
  // re-ringing items they still have in front of them.
  const detail =
    reason === "browser-offline"
      ? "This till has no network connection. Sales can't be completed, but the current sale is safe."
      : "The till can't reach the server. Sales can't be completed, but the current sale is safe.";

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-danger/30 bg-danger-tint px-4 py-2.5 text-danger-text"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-danger" />
      <span className="text-body font-medium">Offline</span>
      <span className="text-body min-w-0">{detail}</span>
      <span className="flex-1" />
      <Button
        className="min-h-tap text-body shrink-0 rounded border-border bg-card px-4 font-medium text-foreground hover:bg-muted"
        disabled={isRechecking}
        onClick={recheck}
        type="button"
        variant="outline"
      >
        {isRechecking ? "Checking..." : "Retry now"}
      </Button>
    </div>
  );
}
