"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";

import { PurchaseInvoiceActionsMenu } from "@/components/purchasing/purchase-invoice-actions-menu";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
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

export function PurchaseInvoicesTable({
  canManage,
  invoices,
  onCancel,
  onEdit,
  onPost,
  onReceive,
}: {
  canManage: boolean;
  invoices: PurchaseInvoice[];
  onCancel: (invoice: PurchaseInvoice) => void;
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
              <PurchaseInvoiceActionsMenu
                canManage={canManage}
                invoice={invoice}
                onCancel={onCancel}
                onEdit={onEdit}
                onPost={onPost}
                onReceive={onReceive}
                onView={(selectedInvoice) =>
                  router.push(`${ROUTES.purchasingInvoices}/${selectedInvoice.id}`)
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
