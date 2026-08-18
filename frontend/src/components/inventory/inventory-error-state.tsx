import type { JSX } from "react";

import { FailedState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical failed state (DESIGN.md 8, plan item E2).
 *
 * The call signature is unchanged on purpose. 23 of these wrappers existed, each
 * rendering its own arrangement of the same idea, across ~120 call sites. Rewriting
 * the bodies converges every module on one treatment; rewriting the call sites
 * instead would have been ~120 edits for the same pixels and a much larger blast
 * radius. The duplication that mattered was the markup, not the prop shape.
 */

export function InventoryErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry: () => void;
}): JSX.Element {
  return <FailedState detail={description} noun="inventory" onRetry={onRetry} />;
}
