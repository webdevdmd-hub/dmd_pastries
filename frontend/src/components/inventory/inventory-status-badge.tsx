import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryRecordStatus } from "@/types/inventory";

type InventoryStatusBadgeProps = {
  status: InventoryRecordStatus;
};

/**
 * Record status as a badge that carries a dot (DESIGN.md sections 6 and 9 --
 * colour may not be the only carrier of state).
 *
 * Three states, three different routes to a dot:
 *
 * - `not_initialized` moves from a className override to `info`, which
 *   resolves to the same tint and text colour it already had.
 * - `inactive` moves from the legacy `secondary` to `draft`. That is a real
 *   colour change, card/foreground to muted/foreground-muted, and it is the
 *   correct one: DESIGN.md section 3.3 calls draft "the absence of a state,
 *   not a state", which is exactly what inactive is.
 * - `active` keeps `variant="default"` and opts into the dot explicitly.
 *   Every semantic variant was wrong for it: `money` would put a second green
 *   badge in the same row as StockLevelBadge's green "Normal" ("if two things
 *   on a screen are green, one of them is wrong", section 3.2), and `draft`
 *   would render it identically to Inactive, destroying the distinction. The
 *   `dot` prop exists for exactly this case.
 */
export function InventoryStatusBadge({ status }: InventoryStatusBadgeProps): JSX.Element {
  if (status === "not_initialized") {
    return <Badge variant="info">Not initialized</Badge>;
  }

  if (status === "active") {
    return (
      <Badge dot variant="default">
        Active
      </Badge>
    );
  }

  return <Badge variant="draft">Inactive</Badge>;
}
