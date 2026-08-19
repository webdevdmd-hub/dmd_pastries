import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/types/inventory";

type StockLevelBadgeProps = {
  item: InventoryItem;
};

/**
 * Stock level as a semantic badge, so it carries a dot.
 *
 * These four states were previously raw `className` colour overrides, which
 * left `variant` at its "default" fallback -- and `default` is one of the
 * legacy dotless variants. The result was a column that carried its state in
 * colour alone, which DESIGN.md section 9 forbids and section 6 explains: the
 * dot is the second, positional signal a colour-blind user reads.
 *
 * The tint and text colours are unchanged; each variant resolves to exactly
 * the pair the className set. Two deliberate side effects: the 1px border the
 * `default` variant was contributing disappears (section 6 specifies tint +
 * -text + dot, no border), and the `hover:bg-*-tint` classes go with it --
 * they were always no-ops, since Badge is a non-interactive div and nothing
 * sets a hover background.
 *
 * "Normal" stays on `money` green rather than moving to the neutral `draft`.
 * Green is meant to be money-only, and a healthy stock level is not a money
 * state -- but changing it would repaint every healthy row, which is a visual
 * decision well beyond "add the missing dots". Deliberately deferred.
 */
export function StockLevelBadge({ item }: StockLevelBadgeProps): JSX.Element {
  if (item.status === "not_initialized") {
    return <Badge variant="info">Needs opening stock</Badge>;
  }

  if (item.availableQuantity <= 0) {
    return <Badge variant="danger">Out of stock</Badge>;
  }

  if (item.lowStock) {
    return <Badge variant="warning">Low stock</Badge>;
  }

  return <Badge variant="money">Normal</Badge>;
}
