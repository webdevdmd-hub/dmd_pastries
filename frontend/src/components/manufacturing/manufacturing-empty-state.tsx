import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 * Signature unchanged so call sites do not move.
 */

export function ManufacturingEmptyState({
  actionLabel,
  onAction,
  description,
  title,
}: {
  title?: string;
  description?: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}): JSX.Element {
  return (
    <EmptyState
      action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined}
      description={description}
      title={title ?? "Nothing here yet"}
    />
  );
}
