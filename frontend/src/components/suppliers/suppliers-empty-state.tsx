import { Truck } from "lucide-react";
import type { JSX } from "react";

import { EmptyState } from "@/components/shared/collection-state";

/**
 * Module adapter for the canonical empty state (DESIGN.md 8, plan item E2).
 *
 * Signature unchanged so call sites do not move. The copy also drops "found" —
 * every one of these said "No X found.", which is search language on a screen that
 * means "none exist yet". That single word is what made empty and filtered
 * indistinguishable.
 */

export function SuppliersEmptyState({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <EmptyState
      action={canManage ? { label: "Add supplier", onClick: onCreate } : undefined}
      description="Suppliers are who you raise purchase orders and bills against."
      icon={Truck}
      title="No suppliers yet"
    />
  );
}
