import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { movementTypeTone } from "@/lib/inventory/stock-movement-display";
import type { MovementType } from "@/types/inventory";

type MovementTypeBadgeProps = {
  type: MovementType;
};

const labels: Record<MovementType, string> = {
  opening_stock: "Opening",
  purchase_in: "Purchase In",
  sale_out: "Sale Out",
  adjustment_in: "Adjust In",
  adjustment_out: "Adjust Out",
  wastage: "Wastage",
  return_in: "Return In",
  transfer: "Stock Transfer",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  production_in: "Production In",
  production_out: "Production Out",
  purchase_return_out: "Vendor Credit",
  purchase_bill_cancel_out: "Purchase Cancellation",
};

/**
 * Semantic variant rather than a className override, so the badge carries a dot
 * (DESIGN.md sections 6 and 9). This copy renders inside the item drawer.
 *
 * The tone comes from movementTypeTone, shared with the same-named component
 * under components/stock-movements. The two had drifted -- outflows were amber
 * here and grey there for the same movement -- which is why the mapping now
 * lives in one place instead of being written out twice.
 */
export function MovementTypeBadge({ type }: MovementTypeBadgeProps): JSX.Element {
  return <Badge variant={movementTypeTone(type)}>{labels[type]}</Badge>;
}
