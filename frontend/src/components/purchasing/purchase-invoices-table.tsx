"use client";

import type { JSX } from "react";

import {
  type PurchaseInvoiceActionHandlers,
  PurchaseInvoiceActionsMenu,
} from "@/components/purchasing/purchase-invoice-actions-menu";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PurchaseInvoice } from "@/types/purchasing";

export type PurchaseInvoicesListProps = PurchaseInvoiceActionHandlers & {
  invoices: PurchaseInvoice[];
  loadingInvoiceId?: string | null;
  /** Opens the bill's details; the whole row is the target. */
  onView: (invoice: PurchaseInvoice) => void;
};

export function formatPurchaseInvoiceCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPurchaseInvoiceDay(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function nextStepForInvoice(invoice: PurchaseInvoice): string {
  if (invoice.status === "draft") {
    return "Post bill";
  }

  if (invoice.status === "cancelled") {
    return "No action";
  }

  if (!invoice.canReceiveStock) {
    return invoice.paymentStatus === "paid" ? "Fully received and paid" : "Fully received";
  }

  if (invoice.paymentStatus === "paid") {
    return "Receive remaining stock";
  }

  return invoice.balanceAmount > 0 ? "Receive stock or record payment" : "Receive stock";
}

export function PurchaseInvoicesTable({
  invoices,
  loadingInvoiceId,
  onView,
  ...actions
}: PurchaseInvoicesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bill no</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Bill date</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Next step</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          // The row opens the drawer; the number is also a button so the
          // keyboard has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={invoice.id} onClick={() => onView(invoice)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(invoice);
                }}
                type="button"
              >
                <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
                {/* Branch is how you recognise a bill you have found, not how
                    you find one. It rides under the number. */}
                <span className="text-meta text-foreground-muted">{invoice.branchName}</span>
              </button>
            </TableCell>
            <TableCell>{invoice.supplierName}</TableCell>
            <TableCell className="tabular-nums">
              {formatPurchaseInvoiceDay(invoice.invoiceDate)}
            </TableCell>
            <TableCell className="tabular-nums">
              {formatPurchaseInvoiceDay(invoice.dueDate)}
            </TableCell>
            <TableCell>
              {/* Two badges, one column. Both answer "what state is this in",
                  and a bill genuinely has two independent ones. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <PurchaseInvoiceStatusBadge status={invoice.status} />
                <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
              </div>
            </TableCell>
            <TableCell className="text-right">
              <span className="grid gap-0.5">
                <span className="font-medium tabular-nums">
                  {formatPurchaseInvoiceCurrency(invoice.totalAmount)}
                </span>
                {/* Balance only earns its own line when it differs from the
                    total. */}
                {invoice.balanceAmount > 0 && invoice.balanceAmount !== invoice.totalAmount ? (
                  <span className="text-meta tabular-nums text-foreground-muted">
                    {formatPurchaseInvoiceCurrency(invoice.balanceAmount)} still due
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="text-foreground-muted">{nextStepForInvoice(invoice)}</TableCell>
            {/* Neither control here may also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-end gap-2">
                {actions.canPost && invoice.status === "draft" ? (
                  <Button
                    disabled={loadingInvoiceId === invoice.id}
                    onClick={() => actions.onPost(invoice)}
                    size="sm"
                    type="button"
                  >
                    Post bill
                  </Button>
                ) : null}
                <PurchaseInvoiceActionsMenu
                  {...actions}
                  invoice={invoice}
                  isLoading={loadingInvoiceId === invoice.id}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
