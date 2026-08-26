"use client";

import { FileText, ReceiptText, RotateCcwSquare, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { EmptyState, FailedState, FilteredState } from "@/components/shared/collection-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseOrder,
  PurchaseReturn,
  SupplierPayment,
} from "@/types/purchasing";
import type { SupplierStatementItem } from "@/types/supplier";

/**
 * Shared by the three panels the old "Purchasing history" card was split into:
 * Purchase history, Documents and Statement. They were one component because
 * they were one scroll; they are separate tabs now, but they still speak about
 * the same documents in the same words.
 */

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

export type RecentDocument = {
  amount: number;
  date: string | null;
  href: string;
  icon: JSX.Element;
  key: string;
  label: string;
  number: string;
  status: JSX.Element;
};

export type StatementDisplayRow = {
  credit: number;
  date: string | null;
  debit: number;
  documentNumber: string;
  key: string;
  runningBalance: number;
  status: JSX.Element;
  type: string;
};

export function invoiceDocuments(invoices: PurchaseInvoice[]): RecentDocument[] {
  return invoices.map((invoice) => ({
    amount: invoice.totalAmount,
    date: invoice.invoiceDate,
    href: `${ROUTES.purchasingInvoices}/${invoice.id}`,
    icon: <ReceiptText className="h-4 w-4" />,
    key: `invoice-${invoice.id}`,
    label: "Bill",
    number: invoice.invoiceNumber,
    status: <PurchaseInvoiceStatusBadge status={invoice.status} />,
  }));
}

export function orderDocuments(orders: PurchaseOrder[]): RecentDocument[] {
  return orders.map((order) => ({
    amount: order.totalAmount,
    date: order.orderDate,
    href: `${ROUTES.purchasingOrders}/${order.id}`,
    icon: <FileText className="h-4 w-4" />,
    key: `order-${order.id}`,
    label: "PO",
    number: order.purchaseOrderNumber,
    status: <PurchaseOrderStatusBadge status={order.status} />,
  }));
}

export function returnDocuments(returns: PurchaseReturn[]): RecentDocument[] {
  return returns.map((purchaseReturn) => ({
    amount: purchaseReturn.returnTotal,
    date: purchaseReturn.returnDate,
    href: `${ROUTES.purchasingReturns}/${purchaseReturn.id}`,
    icon: <RotateCcwSquare className="h-4 w-4" />,
    key: `return-${purchaseReturn.id}`,
    label: "Vendor credit",
    number: purchaseReturn.returnNumber,
    status: <PurchaseReturnStatusBadge status={purchaseReturn.status} />,
  }));
}

export function paymentDocuments(payments: SupplierPayment[]): RecentDocument[] {
  return payments.map((payment) => ({
    amount: payment.amount,
    date: payment.paidAt,
    href: payment.purchaseInvoiceId
      ? `${ROUTES.purchasingInvoices}/${payment.purchaseInvoiceId}`
      : ROUTES.purchasingPayments,
    icon: <WalletCards className="h-4 w-4" />,
    key: `payment-${payment.id}`,
    label: "Payment made",
    number: payment.invoiceNumber,
    status: (
      <PurchasePaymentStatusBadge
        status={payment.paymentStatus === "completed" ? "paid" : "unpaid"}
      />
    ),
  }));
}

function statementTypeLabel(item: SupplierStatementItem): string {
  if (item.transactionType === "payment_made") return "Payment made";
  if (item.transactionType === "vendor_credit") return "Vendor credit";
  return "Bill";
}

function statementStatus(item: SupplierStatementItem): JSX.Element {
  if (item.transactionType === "payment_made") {
    return (
      <PurchasePaymentStatusBadge status={item.paymentStatus === "completed" ? "paid" : "unpaid"} />
    );
  }

  if (item.transactionType === "vendor_credit") {
    return (
      <PurchaseReturnStatusBadge status={item.status === "reversed" ? "reversed" : "posted"} />
    );
  }

  return (
    <PurchaseInvoiceStatusBadge status={item.status === "cancelled" ? "cancelled" : "posted"} />
  );
}

export function statementDisplayRows(items: SupplierStatementItem[]): StatementDisplayRow[] {
  return items.map((item) => ({
    credit: item.creditAmount,
    date: item.transactionDate,
    debit: item.debitAmount,
    documentNumber: item.documentNumber,
    key: `statement-${item.transactionType}-${item.id}`,
    runningBalance: item.runningBalance,
    status: statementStatus(item),
    type: statementTypeLabel(item),
  }));
}

export function formatStatementBalance(value: number): string {
  if (value < 0) {
    return `Supplier credit ${formatCurrency(Math.abs(value))}`;
  }

  return formatCurrency(value);
}

export function itemKey(item: PurchaseInvoiceItem): string {
  return `${item.itemType}-${item.itemNameSnapshot}-${item.unitSymbol}-${String(item.unitCost)}`;
}

export function collectPurchasedItems(invoices: PurchaseInvoice[]): PurchaseInvoiceItem[] {
  const byKey = new Map<string, PurchaseInvoiceItem>();

  invoices.forEach((invoice) => {
    invoice.items.forEach((item) => {
      const key = itemKey(item);
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, item);
        return;
      }

      byKey.set(key, {
        ...existing,
        lineTotal: existing.lineTotal + item.lineTotal,
        quantity: existing.quantity + item.quantity,
      });
    });
  });

  return Array.from(byKey.values())
    .sort((first, second) => second.lineTotal - first.lineTotal)
    .slice(0, 6);
}

/** Filters every purchasing query on this page scopes to one supplier. */
export function supplierScopedFilters(supplierId: string) {
  const base = {
    branchId: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
    status: "all",
    supplierId,
  };

  return {
    orders: base,
    invoices: { ...base, paymentStatus: "all" },
    returns: base,
    payments: {
      branchId: "all",
      dateFrom: "",
      dateTo: "",
      paidByUserId: "",
      paymentMethodId: "all",
      paymentStatus: "all",
      purchaseInvoiceId: "",
      search: "",
      sortBy: "paid_at",
      sortOrder: "desc",
      supplierId,
    },
  };
}

export function PanelSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((slot) => (
          <Skeleton className="h-24 w-full" key={slot} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Failed, not empty. A `--danger-tint` panel that says what broke and offers a
 * way out, which is what separates it from the dashed empty card. DESIGN.md §8.
 */
export function PanelError({
  message,
  noun,
  onRetry,
}: {
  message: string;
  noun: string;
  onRetry: () => void;
}): JSX.Element {
  return <FailedState detail={message} noun={noun} onRetry={onRetry} />;
}

/** Nothing exists yet: neutral and instructive, never an error. */
export function PanelEmpty({
  action,
  description,
  title,
}: {
  action?: { label: string; onClick: () => void } | undefined;
  description: string;
  title: string;
}): JSX.Element {
  return <EmptyState action={action} description={description} title={title} />;
}

/**
 * Things exist, the filter excludes them. A `--muted` inline row that always
 * offers the way back, never the dashed card and never the words "No data".
 */
export function PanelFiltered({
  noun,
  onClearFilters,
}: {
  noun: string;
  onClearFilters: () => void;
}): JSX.Element {
  return <FilteredState noun={noun} onClearFilters={onClearFilters} />;
}
