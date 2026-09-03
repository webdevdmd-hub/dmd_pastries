"use client";

import type { JSX } from "react";

import {
  formatSupplierPaymentCurrency,
  formatSupplierPaymentDay,
  SupplierPaymentActionsMenu,
  type SupplierPaymentsListProps,
  SupplierPaymentStatusBadge,
} from "@/components/purchasing/purchase-supplier-payments-table";
import { Card } from "@/components/ui/card";

/**
 * Payments made as cards, for phones: an eleven-column ledger has no honest
 * layout below md. Clicking a card opens the details drawer; the kebab stops
 * the click so it does not also open the drawer.
 */
export function PurchaseSupplierPaymentsCardGrid({
  onDelete,
  onEdit,
  onView,
  payments,
}: SupplierPaymentsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {payments.map((payment) => (
        <Card
          className={
            onView
              ? "cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
              : "overflow-hidden"
          }
          key={payment.id}
          onClick={onView ? () => onView(payment) : undefined}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium">{payment.supplierName}</span>
              <span className="truncate text-meta text-foreground-muted">
                {payment.branchName} · {formatSupplierPaymentDay(payment.paymentDate)}
              </span>
            </div>
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <SupplierPaymentStatusBadge status={payment.paymentStatus} />
              <SupplierPaymentActionsMenu onDelete={onDelete} onEdit={onEdit} payment={payment} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-cell">
            <span className="font-medium">{payment.paymentMethodName}</span>
            {payment.referenceNumber ? (
              <span className="font-mono text-meta text-foreground-muted">
                {payment.referenceNumber}
              </span>
            ) : null}
            <span className="ml-auto text-title font-medium tabular-nums">
              {formatSupplierPaymentCurrency(payment.amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Used for bills</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatSupplierPaymentCurrency(payment.allocatedAmount)}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Supplier advance</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatSupplierPaymentCurrency(payment.unappliedAmount)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
