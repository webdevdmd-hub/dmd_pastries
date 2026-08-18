import { UserPlus } from "lucide-react";
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

export function UsersEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}): JSX.Element {
  return (
    <EmptyState
      action={canCreate ? { label: "Invite user", onClick: onCreate } : undefined}
      description="Invite staff and assign them a role to give them access."
      icon={UserPlus}
      title="No users yet"
    />
  );
}
