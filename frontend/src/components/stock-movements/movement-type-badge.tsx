import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { movementTypeTone } from "@/lib/inventory/stock-movement-display";
import type { MovementType } from "@/types/stock-movements";

type MovementTypeBadgeProps = {
  type: MovementType;
};

const labels: Record<MovementType, string> = {
  opening_stock: "Opening Stock",
  purchase_in: "Purchase In",
  sale_out: "Sale Out",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  wastage: "Wastage",
  return_in: "Return In",
  transfer: "Stock Transfer",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
  production_in: "Production In",
  production_out: "Production Out",
  purchase_return_out: "Vendor Credit",
  purchase_bill_cancel_out: "Purchase Cancellation",
  reversal: "Reversal",
};

/**
 * Semantic variant rather than a className tint, so the badge carries its dot
 * (DESIGN.md sections 6 and 9).
 *
 * This is the copy that renders the Movements tab and the movement detail
 * drawer. A previous pass converted only the same-named file under
 * components/inventory, so every badge on this screen stayed colour-only --
 * which is exactly the kind of miss a shared basename produces. The tone now
 * comes from movementTypeTone so the two cannot drift again.
 */
export function MovementTypeBadge({ type }: MovementTypeBadgeProps): JSX.Element {
  return <Badge variant={movementTypeTone(type)}>{labels[type]}</Badge>;
}
