"use client";

import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { usePurchaseInvoice } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PurchaseInvoiceDetailsPageClient({
  invoiceId,
}: {
  invoiceId: string;
}): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const invoiceQuery = usePurchaseInvoice(invoiceId, canView);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (invoiceQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <PurchaseErrorState
        description={
          invoiceQuery.error ? getErrorMessage(invoiceQuery.error) : "Purchase invoice not found."
        }
        onRetry={() => {
          void invoiceQuery.refetch();
        }}
      />
    );
  }

  const invoice = invoiceQuery.data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingInvoices}
        >
          Back to Purchase Invoices
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{invoice.invoiceNumber}</h1>
          <PurchaseInvoiceStatusBadge status={invoice.status} />
          <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {invoice.supplierName} · {invoice.branchName}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Total</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Paid</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.paidAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Balance</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.balanceAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Tax</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.taxAmount)}
            </p>
          </CardContent>
        </Card>
      </div>
      <PurchasingItemLines lines={invoice.items} title="Purchase invoice items" />
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{invoice.notes ?? "No notes recorded."}</p>
        </CardContent>
      </Card>
    </div>
  );
}
