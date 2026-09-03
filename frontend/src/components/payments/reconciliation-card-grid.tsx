import type { JSX } from "react";

import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PaymentReconciliation } from "@/types/payment";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-AE") : "Not set";
}

function differenceLabel(value: number): string {
  if (value === 0) return "Balanced";
  if (value > 0) return "Surplus";

  return "Shortage";
}

function differenceTone(value: number): "money" | "warning" | "danger" {
  if (value === 0) return "money";
  if (value > 0) return "warning";

  return "danger";
}

/** Reconciliations as cards, for phones. Read-only, like the table. */
export function ReconciliationCardGrid({
  reconciliations,
}: {
  reconciliations: PaymentReconciliation[];
}): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reconciliations.map((reconciliation) => (
        <Card className="overflow-hidden" key={reconciliation.id}>
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="font-medium tabular-nums">
                {formatDate(reconciliation.reconciliationDate)}
              </span>
              <span className="truncate text-meta text-foreground-muted">
                {reconciliation.branchName} · {reconciliation.createdByUserName}
              </span>
            </div>
            <PaymentStatusBadge status={reconciliation.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <PaymentMethodBadge methodName={reconciliation.paymentMethodName} />
            <Badge className="ml-auto" variant={differenceTone(reconciliation.differenceAmount)}>
              {differenceLabel(reconciliation.differenceAmount)}
            </Badge>
          </div>

          <div className="grid grid-cols-3 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Expected</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatMoney(reconciliation.expectedAmount)}
              </p>
            </div>
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Counted</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatMoney(reconciliation.countedAmount)}
              </p>
            </div>
            <div className="min-w-0 px-3 py-3">
              <p className="text-meta text-foreground-muted">Difference</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatMoney(reconciliation.differenceAmount)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
