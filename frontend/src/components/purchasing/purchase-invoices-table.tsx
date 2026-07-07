"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

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
          <TableHead>Invoice Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Invoice Date</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Next Step</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link
                className="font-semibold text-brand-espresso"
                href={`${ROUTES.purchasingInvoices}/${invoice.id}`}
              >
                {invoice.invoiceNumber}
              </Link>
            </TableCell>
            <TableCell>{invoice.supplierName}</TableCell>
            <TableCell>{invoice.branchName}</TableCell>
            <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
            <TableCell>
              <PurchaseInvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell>
              <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
            </TableCell>
            <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
            <TableCell>{formatCurrency(invoice.balanceAmount)}</TableCell>
            <TableCell>
              <span className="text-sm font-medium text-brand-mocha">
                {nextStepForInvoice(invoice)}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
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
