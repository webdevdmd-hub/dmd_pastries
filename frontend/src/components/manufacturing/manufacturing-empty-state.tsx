import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md §8, plan item E2).
 *
 * `title` is required. It used to default to "Nothing here yet", which breaks
 * the §8 rule that the title names what is missing — and a caller that simply
 * forgot got the generic string with no warning. Batches shipped that way.
 */
export function ManufacturingEmptyState({
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
