import { ClipboardList } from "lucide-react";
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

export function OrdersEmptyState({
  canManage,
  onCreate,
}: {
  canManage: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <EmptyState
      action={canManage ? { label: "Create order", onClick: onCreate } : undefined}
      description="Orders scheduled for collection or delivery appear here once they are placed."
      icon={ClipboardList}
      title="No bakery orders yet"
    />
  );
}
