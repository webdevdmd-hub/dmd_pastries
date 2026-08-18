import type { JSX } from "react";

import { FailedState } from "@/components/shared/collection-state";

/**
 * Adapter over the canonical failed state (plan item E2).
 *
 * Kept because six call sites use it, including app/error.tsx, where the title is
 * genuinely arbitrary rather than a collection noun. `retryLabel` is accepted and
 * ignored: FailedState always says "Try again", and a retry button that says
 * something different on each screen was part of what made these inconsistent.
 */
export function ErrorState({
  description,
  onRetry,
  title,
}: {
  title: string;
  description: string;
  retryLabel?: string | undefined;
  onRetry?: (() => void) | undefined;
}): JSX.Element {
  return <FailedState detail={description} noun={title} onRetry={onRetry} />;
}
