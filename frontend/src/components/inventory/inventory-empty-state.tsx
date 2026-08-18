import { PackageOpen } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 * Signature unchanged so call sites do not move.
 */
export function InventoryEmptyState({
  canManage = false,
  description = "Create opening stock to begin tracking branch-level product quantities.",
  onCreate,
  title = "No inventory yet",
}: {
  canManage?: boolean | undefined;
  onCreate?: (() => void) | undefined;
  title?: string | undefined;
  description?: string | undefined;
}): JSX.Element {
  return (
    <EmptyState
      action={canManage && onCreate ? { label: "Add opening stock", onClick: onCreate } : undefined}
      description={description}
      icon={PackageOpen}
      title={title}
    />
  );
}
