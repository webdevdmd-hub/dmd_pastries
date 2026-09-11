"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { runLiveUpdates } from "@/lib/live-updates";

/**
 * Keeps the live-update stream open for as long as someone is signed in.
 * Renders nothing. Mounted once, inside AuthProvider, so signing out closes
 * the stream and signing in opens a fresh one under the new token.
 */
export function LiveUpdatesProvider(): JSX.Element | null {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const controller = new AbortController();
    void runLiveUpdates(queryClient, controller.signal);
    return () => {
      controller.abort();
    };
  }, [isAuthenticated, queryClient]);

  return null;
}
