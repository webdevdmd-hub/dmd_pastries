import { Settings } from "lucide-react";
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

export function SettingsEmptyState(): JSX.Element {
  return (
    <EmptyState
      description="Your role does not include access to any settings sections."
      icon={Settings}
      title="No settings available"
    />
  );
}
