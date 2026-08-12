import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { PurchasePaymentStatus } from "@/types/purchasing";

const labels: Record<PurchasePaymentStatus, string> = {
  overdue: "Overdue",
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

const toneByStatus: Record<PurchasePaymentStatus, string> = {
  overdue: "border-red-300 bg-red-50 text-red-800",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-800",
  partial: "border-amber-300 bg-amber-50 text-amber-900",
  unpaid: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

export function PurchasePaymentStatusBadge({
  status,
}: {
  status: PurchasePaymentStatus;
}): JSX.Element {
  return (
    <Badge className={cn("font-semibold", toneByStatus[status])} variant="outline">
      {labels[status]}
    </Badge>
  );
}
