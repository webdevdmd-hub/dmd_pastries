"use client";

import { useEffect } from "react";

import { attemptChunkReload, isChunkLoadError } from "@/lib/errors/chunk-load";

/**
 * Recovers from chunk-load failures that React error boundaries cannot catch.
 *
 * A chunk that fails to load during a route transition rejects a promise that
 * is never rendered into the tree, so it surfaces as an *unhandled rejection*
 * (or a window `error` event) rather than a render error — leaving the user
 * stranded on whatever was on screen (typically a loading state). This listens
 * globally for those and triggers a single guarded reload to fetch the current
 * chunk manifest.
 */
export function ChunkReloadProvider(): null {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent): void => {
      if (isChunkLoadError(event.reason)) {
        attemptChunkReload();
      }
    };

    const handleError = (event: ErrorEvent): void => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        attemptChunkReload();
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}
