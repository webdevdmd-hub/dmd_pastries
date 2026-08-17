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

  return (
    <Badge
      className={
        isDanger
          ? "bg-danger-tint text-danger-text hover:bg-danger-tint"
          : isOut
            ? "bg-warning-tint text-warning-text hover:bg-warning-tint"
            : "bg-money-tint text-money-text hover:bg-money-tint"
      }
    >
      {labels[type]}
    </Badge>
  );
}
