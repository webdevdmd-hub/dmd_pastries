import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
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

export function MovementTypeBadge({ type }: MovementTypeBadgeProps): JSX.Element {
  if (type === "reversal") {
    return (
      <Badge className="bg-violet-100 text-violet-900 hover:bg-violet-100">{labels[type]}</Badge>
    );
  }

  if (
    type === "sale_out" ||
    type === "adjustment_out" ||
    type === "wastage" ||
    type === "production_out" ||
    type === "purchase_return_out" ||
    type === "purchase_bill_cancel_out"
  ) {
    return (
      <Badge className="bg-orange-100 text-orange-900 hover:bg-orange-100">{labels[type]}</Badge>
    );
  }

  return (
    <Badge className="bg-money-tint text-money-text hover:bg-money-tint">{labels[type]}</Badge>
  );
}
