"use client";

import type { JSX } from "react";

import { PurchaseInvoiceActionsMenu } from "@/components/purchasing/purchase-invoice-actions-menu";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import {
  formatPurchaseInvoiceCurrency,
  formatPurchaseInvoiceDay,
  nextStepForInvoice,
  type PurchaseInvoicesListProps,
} from "@/components/purchasing/purchase-invoices-table";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { Card } from "@/components/ui/card";

/**
 * Bills as cards, for phones: an eight-column ledger has no honest layout
 * below md. Clicking a card opens the details drawer; the kebab stops the
 * click so it does not also open the drawer.
 */
export function PurchaseInvoicesCardGrid({
  invoices,
  loadingInvoiceId,
  onView,
  ...actions
}: PurchaseInvoicesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {invoices.map((invoice) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={invoice.id}
          onClick={() => onView(invoice)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(invoice);
              }}
              type="button"
            >
              <span className="truncate font-mono font-medium">{invoice.invoiceNumber}</span>
              <span className="truncate text-meta text-foreground-muted">
                {invoice.supplierName} · {invoice.branchName}
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <PurchaseInvoiceActionsMenu
                {...actions}
                invoice={invoice}
                isLoading={loadingInvoiceId === invoice.id}
              />
            </div>
          </div>

          <div className="grid gap-2 px-4 py-3 text-cell">
            <div className="flex flex-wrap items-center gap-1.5">
              <PurchaseInvoiceStatusBadge status={invoice.status} />
              <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
            </div>
            <span className="text-foreground-muted">{nextStepForInvoice(invoice)}</span>
          </div>

          <div className="grid grid-cols-3 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Billed</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatPurchaseInvoiceDay(invoice.invoiceDate)}
              </p>
            </div>
            <div className="min-w-0 border-r border-workspace-border px-3 py-3">
              <p className="text-meta text-foreground-muted">Due</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatPurchaseInvoiceDay(invoice.dueDate)}
              </p>
            </div>
            <div className="min-w-0 px-3 py-3">
              <p className="text-meta text-foreground-muted">Amount</p>
              <p className="mt-1 break-words text-cell font-medium tabular-nums">
                {formatPurchaseInvoiceCurrency(invoice.totalAmount)}
              </p>
              {invoice.balanceAmount > 0 && invoice.balanceAmount !== invoice.totalAmount ? (
                <p className="text-meta tabular-nums text-foreground-muted">
                  {formatPurchaseInvoiceCurrency(invoice.balanceAmount)} due
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
