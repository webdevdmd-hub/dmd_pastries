import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { MovementDirection } from "@/types/stock-movements";

type MovementDirectionBadgeProps = {
  direction: MovementDirection;
};

/**
 * Direction was the seventh badge family in the module and the last one still
 * carrying its state in colour alone: the three cases painted a tint through
 * `className` on the dotless `default` variant, so a colour-blind reader had
 * nothing else to go on (DESIGN.md sections 6 and 9). It also meant every badge
 * kept `default`'s 1px border underneath a tint that was never meant to have
 * one.
 *
 * Semantic variants render the 5px dot themselves, so the fills are unchanged
 * and the signal is no longer colour-only. `out` maps to `draft` because that
 * variant is already `bg-muted` / `text-foreground-muted` -- the exact pair the
 * className set, so it is a dot-only change.
 *
 * `neutral` takes `default` with the dot forced on rather than a semantic
 * variant: it is the absence of a direction, so it must not borrow a semantic
 * colour, but it still needs the non-colour signal its neighbours have. Same
 * treatment `inventory-status-badge.tsx` gives "Active".
 */
export function MovementDirectionBadge({ direction }: MovementDirectionBadgeProps): JSX.Element {
  if (direction === "in") {
    return <Badge variant="money">In</Badge>;
  }

  if (direction === "out") {
    return <Badge variant="draft">Out</Badge>;
  }

  if (direction === "transfer") {
    return <Badge variant="info">Transfer</Badge>;
  }

  return (
    <Badge dot variant="default">
      Neutral
    </Badge>
  );
}
