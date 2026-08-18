import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 * Signature unchanged so call sites do not move.
 */

export function AppEmptyState({
  actionLabel,
  icon,
  onAction,
  description,
  title,
}: {
  title: string;
  description: string;
  icon?: LucideIcon | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}): JSX.Element {
  return (
    <EmptyState
      action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined}
      description={description}
      icon={icon}
      title={title}
    />
  );
}
