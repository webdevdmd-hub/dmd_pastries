"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { attemptChunkReload, isChunkLoadError } from "@/lib/errors/chunk-load";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps): JSX.Element {
  // When a chunk fails to load, a full reload pulls the current manifest and
  // recovers. We render a neutral placeholder while that reload happens.
  const [reloading] = useState(() => isChunkLoadError(error) && attemptChunkReload());

  useEffect(() => {
    // Surface the crash for observability; the boundary itself stays silent.
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-latte px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        {reloading ? (
          <p className="text-center text-sm text-brand-espresso/70">Reloading…</p>
        ) : (
          <ErrorState
            description="An unexpected error interrupted this page. You can try again, or reload if the problem continues."
            onRetry={reset}
            retryLabel="Try again"
            title="Something went wrong"
          />
        )}
        {!reloading ? (
          <div className="mt-4 flex justify-center">
            <Button onClick={() => window.location.reload()} size="sm" variant="ghost">
              Reload the page
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
