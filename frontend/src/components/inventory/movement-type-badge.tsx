import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
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

export function MovementTypeBadge({ type }: MovementTypeBadgeProps): JSX.Element {
  const isOut =
    type === "sale_out" ||
    type === "adjustment_out" ||
    type === "production_out" ||
    type === "purchase_return_out" ||
    type === "purchase_bill_cancel_out";
  const isDanger = type === "wastage";

  // Semantic variants rather than className overrides, so the badge carries a
  // dot (DESIGN.md sections 6 and 9). Tint and text colours are unchanged.
  // This one renders inside the details drawer, so leaving it dotless would
  // have put dotted and dotless badges directly above each other.
  return <Badge variant={isDanger ? "danger" : isOut ? "warning" : "money"}>{labels[type]}</Badge>;
}
