import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PurchaseReceipt } from "@/types/purchasing";

const statusClasses: Record<PurchaseReceipt["accountingStatus"], string> = {
  accounted_at_bill_posting: "border-money/30 bg-money-tint text-money-text",
  not_applicable: "border-border bg-muted text-foreground-muted",
  pending_accounting_journal: "border-danger/30 bg-danger-tint text-danger-text",
  pending_bill_posting: "border-warning/30 bg-warning-tint text-warning-text",
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
