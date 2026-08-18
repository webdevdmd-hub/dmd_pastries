import { ShieldPlus } from "lucide-react";
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

export function RolesEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <EmptyState
      action={canCreate ? { label: "Create role", onClick: onCreate } : undefined}
      description="Roles control what staff can see and do across the app."
      icon={ShieldPlus}
      title="No custom roles yet"
    />
  );
}
