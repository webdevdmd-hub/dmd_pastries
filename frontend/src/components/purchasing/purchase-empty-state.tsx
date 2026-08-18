import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md §8, plan item E2).
 *
 * `title` is required — see manufacturing-empty-state.tsx. The shared default
 * of "Nothing here yet" let purchase orders ship without naming its noun.
 */
export function PurchaseEmptyState({
  actionLabel,
  onAction,
  description,
  title,
}: {
  title: string;
  description?: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}): JSX.Element {
  return (
    <EmptyState
      action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined}
      description={description}
      title={title}
    />
  );
}
