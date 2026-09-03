import type { JSX } from "react";

import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Card } from "@/components/ui/card";
import type { PaymentRefund } from "@/types/payment";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Pending";
}

/** The refunds ledger as cards, for phones. Read-only, like the table. */
export function RefundsCardGrid({ refunds }: { refunds: PaymentRefund[] }): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {refunds.map((refund) => (
        <Card className="overflow-hidden" key={refund.id}>
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-mono font-medium">{refund.refundNumber}</span>
              <span className="font-mono text-meta text-foreground-muted">
                Sale {refund.saleNumber}
              </span>
            </div>
            <PaymentStatusBadge status={refund.refundStatus} />
          </div>

          <div className="grid gap-2 px-4 py-3 text-cell">
            <div className="flex flex-wrap items-center gap-2">
              <PaymentMethodBadge methodName={refund.paymentMethodNameSnapshot} />
              <span className="ml-auto text-title font-medium tabular-nums">
                {formatMoney(refund.refundAmount)}
              </span>
            </div>
            <p className="text-foreground-muted">{refund.refundReason}</p>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Created by</p>
              <p className="mt-1 truncate text-cell font-medium">{refund.createdByUserName}</p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Refunded at</p>
              <p className="mt-1 truncate text-cell font-medium tabular-nums">
                {formatDate(refund.refundedAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
