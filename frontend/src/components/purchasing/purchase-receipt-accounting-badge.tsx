import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseReceipt } from "@/types/purchasing";

const statusClasses: Record<PurchaseReceipt["accountingStatus"], string> = {
  accounted_at_bill_posting: "border-emerald-200 bg-emerald-50 text-emerald-800",
  not_applicable: "border-slate-200 bg-slate-50 text-slate-700",
  pending_accounting_journal: "border-red-200 bg-red-50 text-red-800",
  pending_bill_posting: "border-amber-200 bg-amber-50 text-amber-800",
};

export function PurchaseReceiptAccountingBadge({
  receipt,
}: {
  receipt: PurchaseReceipt;
}): JSX.Element {
  return (
    <Badge className={statusClasses[receipt.accountingStatus]}>
      {receipt.accountingStatusLabel || "Not applicable"}
    </Badge>
  );
}
