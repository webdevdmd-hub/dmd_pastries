"use client";

import { FileText, PackageSearch, ReceiptText, RotateCcwSquare, WalletCards } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import {
  usePurchaseInvoices,
  usePurchaseOrders,
  usePurchaseReturns,
  useSupplierPayments,
} from "@/hooks/use-purchasing";
import { useSupplierStatement } from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchaseOrder,
  PurchaseReturn,
  SupplierPayment,
} from "@/types/purchasing";
import type { SupplierStatementItem } from "@/types/supplier";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

type RecentDocument = {
  amount: number;
  date: string | null;
  href: string;
  icon: JSX.Element;
  key: string;
  label: string;
  number: string;
  status: JSX.Element;
};

type StatementDisplayRow = {
  credit: number;
  date: string | null;
  debit: number;
  documentNumber: string;
  key: string;
  runningBalance: number;
  status: JSX.Element;
  type: string;
};

function invoiceDocuments(invoices: PurchaseInvoice[]): RecentDocument[] {
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

function orderDocuments(orders: PurchaseOrder[]): RecentDocument[] {
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

function returnDocuments(returns: PurchaseReturn[]): RecentDocument[] {
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

function paymentDocuments(payments: SupplierPayment[]): RecentDocument[] {
  return payments.map((payment) => ({
    amount: payment.amount,
    date: payment.paidAt,
    href: payment.purchaseInvoiceId
      ? `${ROUTES.purchasingInvoices}/${payment.purchaseInvoiceId}`
      : ROUTES.purchasingPayments,
    icon: <WalletCards className="h-4 w-4" />,
    key: `payment-${payment.id}`,
    label: "Payment Made",
    number: payment.invoiceNumber,
    status: (
      <PurchasePaymentStatusBadge
        status={payment.paymentStatus === "completed" ? "paid" : "unpaid"}
      />
    ),
  }));
}

function statementTypeLabel(item: SupplierStatementItem): string {
  if (item.transactionType === "payment_made") return "Payment Made";
  if (item.transactionType === "vendor_credit") return "Vendor Credit";
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

function statementDisplayRows(items: SupplierStatementItem[]): StatementDisplayRow[] {
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

function formatStatementBalance(value: number): string {
  if (value < 0) {
    return `Supplier credit ${formatCurrency(Math.abs(value))}`;
  }

  return formatCurrency(value);
}

function itemKey(item: PurchaseInvoiceItem): string {
  return `${item.itemType}-${item.itemNameSnapshot}-${item.unitSymbol}-${String(item.unitCost)}`;
}

function collectPurchasedItems(invoices: PurchaseInvoice[]): PurchaseInvoiceItem[] {
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

function HistorySkeleton(): JSX.Element {
  return (
    <Card className="border-brand-cappuccino bg-white/85">
      <CardHeader>
        <Skeleton className="h-6 w-56" />
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <Skeleton className="h-24 rounded-2xl" key={key} />
        ))}
      </CardContent>
    </Card>
  );
}

export function SupplierPurchasingHistory({
  canView,
  supplierId,
}: {
  canView: boolean;
  supplierId: string;
}): JSX.Element {
  const orderFilters = {
    branchId: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
    status: "all",
    supplierId,
  };
  const invoiceFilters = {
    ...orderFilters,
    paymentStatus: "all",
  };
  const returnFilters = {
    branchId: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
    status: "all",
    supplierId,
  };
  const paymentFilters = {
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
  };

  const ordersQuery = usePurchaseOrders(orderFilters, canView);
  const invoicesQuery = usePurchaseInvoices(invoiceFilters, canView);
  const returnsQuery = usePurchaseReturns(returnFilters, canView);
  const paymentsQuery = useSupplierPayments(paymentFilters, canView);
  const statementQuery = useSupplierStatement(supplierId, {}, canView);

  const isLoading =
    ordersQuery.isLoading ||
    invoicesQuery.isLoading ||
    returnsQuery.isLoading ||
    paymentsQuery.isLoading ||
    statementQuery.isLoading;

  if (isLoading) {
    return <HistorySkeleton />;
  }

  const orders = ordersQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const returns = returnsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const statement = statementQuery.data;
  const queryError =
    ordersQuery.error ??
    invoicesQuery.error ??
    returnsQuery.error ??
    paymentsQuery.error ??
    statementQuery.error ??
    null;

  const totalPurchased = invoices.reduce((total, invoice) => total + invoice.totalAmount, 0);
  const totalPaid = payments.reduce((total, payment) => total + payment.amount, 0);
  const outstanding = invoices.reduce((total, invoice) => total + invoice.balanceAmount, 0);
  const vendorCredits = returns.reduce((total, purchaseReturn) => {
    if (purchaseReturn.status === "cancelled" || purchaseReturn.status === "reversed") {
      return total;
    }

    return total + purchaseReturn.openCreditAmount;
  }, 0);
  const purchasedItems = collectPurchasedItems(invoices);
  const recentDocuments = [
    ...invoiceDocuments(invoices),
    ...orderDocuments(orders),
    ...returnDocuments(returns),
    ...paymentDocuments(payments),
  ]
    .sort((first, second) => {
      const firstDate = first.date ? new Date(first.date).getTime() : 0;
      const secondDate = second.date ? new Date(second.date).getTime() : 0;
      return secondDate - firstDate;
    })
    .slice(0, 8);
  const statementRows = statementDisplayRows(statement?.items ?? []);

  return (
    <Card className="overflow-hidden border-brand-cappuccino bg-white/90">
      <CardHeader className="border-b border-brand-cappuccino bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-mocha">
              Vendor ledger
            </p>
            <CardTitle className="mt-1 text-xl text-brand-espresso">Purchasing history</CardTitle>
            <p className="mt-2 text-sm text-brand-mocha">
              Track what was bought, how much is paid, what remains outstanding, and related
              supplier documents.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={ROUTES.purchasing}>Open purchase workflow</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-5">
        {queryError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Unable to load full supplier purchasing history. {getErrorMessage(queryError)}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total purchased", value: formatCurrency(totalPurchased) },
            { label: "Paid to supplier", value: formatCurrency(totalPaid) },
            { label: "Outstanding", value: formatCurrency(outstanding) },
            { label: "Open vendor credits", value: formatCurrency(vendorCredits) },
          ].map((metric) => (
            <div
              className="rounded-2xl border border-brand-cappuccino bg-brand-latte/35 p-4"
              key={metric.label}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-mocha">
                {metric.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-espresso">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-brand-cappuccino bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-brand-espresso">Purchased items</h3>
                <p className="mt-1 text-sm text-brand-mocha">
                  Item snapshots from loaded supplier bills.
                </p>
              </div>
              <PackageSearch className="h-5 w-5 text-brand-mocha" />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {purchasedItems.length > 0 ? (
                purchasedItems.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-cappuccino bg-brand-latte/25 p-3"
                    key={itemKey(item)}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-brand-espresso">
                        {item.itemNameSnapshot}
                      </p>
                      <p className="text-xs text-brand-mocha">
                        {item.quantity} {item.unitSymbol} at {formatCurrency(item.unitCost)}
                      </p>
                    </div>
                    <Badge className="shrink-0" variant="secondary">
                      {formatCurrency(item.lineTotal)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-brand-cappuccino bg-brand-latte/25 p-4 text-sm text-brand-mocha">
                  No item-level bill lines are available in the loaded supplier records yet. Open a
                  bill to view its full item table.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-cappuccino bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-brand-espresso">Recent purchase documents</h3>
                <p className="mt-1 text-sm text-brand-mocha">
                  Orders, bills, payments, and vendor credits linked to this supplier.
                </p>
              </div>
              <ReceiptText className="h-5 w-5 text-brand-mocha" />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {recentDocuments.length > 0 ? (
                recentDocuments.map((document) => (
                  <Link
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-cappuccino bg-white p-3 transition hover:border-brand-caramel hover:bg-brand-latte/30"
                    href={document.href}
                    key={document.key}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="rounded-xl bg-brand-latte p-2 text-brand-mocha">
                        {document.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-brand-espresso">
                          {document.label} {document.number}
                        </p>
                        <p className="text-xs text-brand-mocha">{formatDate(document.date)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-brand-espresso">
                        {formatCurrency(document.amount)}
                      </span>
                      {document.status}
                    </div>
                  </Link>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-brand-cappuccino bg-brand-latte/25 p-4 text-sm text-brand-mocha">
                  No purchase documents are linked to this supplier yet.
                </p>
              )}
            </div>
          </section>
        </div>

        <section
          className="overflow-hidden rounded-2xl border border-brand-cappuccino bg-white"
          id="statement"
        >
          <div className="border-b border-brand-cappuccino p-4">
            <h3 className="font-semibold text-brand-espresso">Vendor statement</h3>
            <p className="mt-1 text-sm text-brand-mocha">
              Running supplier balance from bills, payments made, and vendor credits.
            </p>
          </div>
          <div className="grid gap-3 border-b border-brand-cappuccino bg-brand-latte/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Opening balance",
                value: formatStatementBalance(statement?.openingBalance ?? 0),
              },
              { label: "Total debit", value: formatCurrency(statement?.totalDebit ?? 0) },
              { label: "Total credit", value: formatCurrency(statement?.totalCredit ?? 0) },
              {
                label: "Closing balance",
                value: formatStatementBalance(statement?.closingBalance ?? 0),
              },
            ].map((metric) => (
              <div
                className="rounded-xl border border-brand-cappuccino bg-white px-3 py-2"
                key={metric.label}
              >
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-brand-mocha">
                  {metric.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-espresso">{metric.value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-brand-latte/50 text-left text-xs uppercase tracking-[0.18em] text-brand-mocha">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Document</th>
                  <th className="px-4 py-3 text-right font-semibold">Debit</th>
                  <th className="px-4 py-3 text-right font-semibold">Credit</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-cappuccino">
                {statementRows.length > 0 ? (
                  statementRows.map((row) => (
                    <tr className="bg-white" key={row.key}>
                      <td className="px-4 py-3 text-brand-mocha">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 font-semibold text-brand-espresso">{row.type}</td>
                      <td className="px-4 py-3 text-brand-mocha">{row.documentNumber}</td>
                      <td className="px-4 py-3 text-right text-brand-espresso">
                        {row.debit > 0 ? formatCurrency(row.debit) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-espresso">
                        {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-espresso">
                        {formatCurrency(row.runningBalance)}
                      </td>
                      <td className="px-4 py-3">{row.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-brand-mocha" colSpan={7}>
                      No statement activity is available for this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-brand-cappuccino bg-brand-latte/40">
                <tr>
                  <td className="px-4 py-3 font-semibold text-brand-espresso" colSpan={3}>
                    Statement total
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-espresso">
                    {formatCurrency(statement?.totalDebit ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-espresso">
                    {formatCurrency(statement?.totalCredit ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-espresso">
                    {formatStatementBalance(statement?.closingBalance ?? 0)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
