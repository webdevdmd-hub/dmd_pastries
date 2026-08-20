"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX, MouseEvent as ReactMouseEvent } from "react";

import { PurchaseInvoiceActionsMenu } from "@/components/purchasing/purchase-invoice-actions-menu";
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
import { ROUTES } from "@/constants/routes";
import type { PurchaseInvoice } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function nextStepForInvoice(invoice: PurchaseInvoice): string {
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

/**
 * A click anywhere in the row opens the bill, except where the row already has
 * something else to do: the number is a link, the last cell holds Post Bill and
 * the actions menu, and a click that ends a text selection is a read.
 */
function shouldOpenInvoice(event: ReactMouseEvent<HTMLTableRowElement>): boolean {
  if (event.target instanceof Element && event.target.closest("a,button,[role='menuitem']")) {
    return false;
  }

  return (window.getSelection()?.toString().length ?? 0) === 0;
}

export function PurchaseInvoicesTable({
  canConvertToReceipt,
  canManage,
  canPost,
  invoices,
  loadingInvoiceId,
  onCancel,
  onConvertToReceipt,
  onEdit,
  onPost,
  onReceive,
}: {
  canConvertToReceipt: boolean;
  canManage: boolean;
  canPost: boolean;
  invoices: PurchaseInvoice[];
  loadingInvoiceId?: string | null;
  onCancel: (invoice: PurchaseInvoice) => void;
  onConvertToReceipt: (invoice: PurchaseInvoice) => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onPost: (invoice: PurchaseInvoice) => void;
  onReceive: (invoice: PurchaseInvoice) => void;
}): JSX.Element {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bill No</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Bill Date</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Next Step</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow
            className="cursor-pointer"
            key={invoice.id}
            onClick={(event) => {
              if (!shouldOpenInvoice(event)) return;
              router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
            }}
          >
            <TableCell>
              <div>
                <Link
                  className="font-semibold text-brand-espresso"
                  href={`${ROUTES.purchasingInvoices}/${invoice.id}`}
                >
                  {invoice.invoiceNumber}
                </Link>
                {/* Branch is how you recognise a bill you have found, not how
                    you find one. It rides under the number, as it does on the
                    purchase order list. */}
                <p className="text-meta text-foreground-muted">{invoice.branchName}</p>
              </div>
            </TableCell>
            <TableCell>{invoice.supplierName}</TableCell>
            <TableCell className="tabular-nums">{formatDate(invoice.invoiceDate)}</TableCell>
            <TableCell className="tabular-nums">{formatDate(invoice.dueDate)}</TableCell>
            <TableCell>
              {/* Two badges, one column. Both answer "what state is this in", and
                  a bill genuinely has two independent ones. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <PurchaseInvoiceStatusBadge status={invoice.status} />
                <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrency(invoice.totalAmount)}
              {/* Balance only earns its own line when it differs from the total.
                  On an unpaid bill the two are equal and the payment badge
                  already says so; on a paid one it is zero. */}
              {invoice.balanceAmount > 0 && invoice.balanceAmount !== invoice.totalAmount ? (
                <p className="text-meta text-foreground-muted">
                  {formatCurrency(invoice.balanceAmount)} still due
                </p>
              ) : null}
            </TableCell>
            <TableCell>
              <span className="text-meta text-foreground-muted">{nextStepForInvoice(invoice)}</span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                {canPost && invoice.status === "draft" ? (
                  <Button
                    disabled={loadingInvoiceId === invoice.id}
                    onClick={() => onPost(invoice)}
                    size="sm"
                    type="button"
                  >
                    Post Bill
                  </Button>
                ) : null}
                <PurchaseInvoiceActionsMenu
                  canConvertToReceipt={canConvertToReceipt}
                  canManage={canManage}
                  canPost={canPost}
                  invoice={invoice}
                  isLoading={loadingInvoiceId === invoice.id}
                  onCancel={onCancel}
                  onConvertToReceipt={onConvertToReceipt}
                  onEdit={onEdit}
                  onPost={onPost}
                  onReceive={onReceive}
                  onView={(selectedInvoice) =>
                    router.push(`${ROUTES.purchasingInvoices}/${selectedInvoice.id}`)
                  }
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
