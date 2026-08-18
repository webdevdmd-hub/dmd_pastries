import { ArrowLeftRight } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 * Signature unchanged so call sites do not move.
 */

export function MovementsEmptyState({
  description,
  title,
}: {
  title?: string | undefined;
  description?: string | undefined;
}): JSX.Element {
  return (
    <EmptyState
      description={description}
      icon={ArrowLeftRight}
      title={title ?? "No stock movements yet"}
    />
  );
}
