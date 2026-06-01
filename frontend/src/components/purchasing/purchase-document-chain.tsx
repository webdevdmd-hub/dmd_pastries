"use client";

import { ArrowRight, FileCheck2, FileText, PackageCheck, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { getErrorMessage } from "@/lib/api/client";
import type { PurchaseDocumentChain, SupplierPayment } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function ChainCard({
  children,
  description,
  href,
  icon,
  title,
}: {
  children?: ReactNode;
  description: string;
  href?: string | undefined;
  icon: ReactNode;
  title: string;
}): JSX.Element {
  const content = (
    <div className="h-full rounded-2xl border border-brand-cappuccino bg-white/85 p-4 transition hover:border-brand-caramel/70 hover:bg-white">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-latte p-2 text-brand-mocha">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-espresso">{title}</p>
          <p className="mt-1 text-xs text-brand-mocha">{description}</p>
          {children ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link className="block h-full" href={href}>
      {content}
    </Link>
  );
}

function PaymentCard({ payment }: { payment: SupplierPayment }): JSX.Element {
  return (
    <ChainCard
      description={`${formatDate(payment.paidAt)} - ${payment.paymentMethodName}`}
      icon={<ReceiptText className="h-4 w-4" />}
      title={payment.invoiceNumber}
    >
      <Badge variant="secondary">{formatCurrency(payment.amount)}</Badge>
      <PurchasePaymentStatusBadge
        status={payment.paymentStatus === "completed" ? "paid" : "unpaid"}
      />
    </ChainCard>
  );
}

export function PurchaseDocumentChain({
  chain,
  error,
  isLoading,
  onRetry,
}: {
  chain: PurchaseDocumentChain | undefined;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
}): JSX.Element {
  if (isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (error) {
    return (
      <PurchaseErrorState
        description={getErrorMessage(error)}
        onRetry={onRetry}
        title="Unable to load document chain"
      />
    );
  }

  const purchaseOrder = chain?.purchaseOrder ?? null;
  const invoices = chain?.purchaseInvoices ?? [];
  const receipts = chain?.purchaseReceipts ?? [];
  const payments = chain?.supplierPayments ?? [];
  const hasNextSteps = invoices.length > 0 || receipts.length > 0 || payments.length > 0;

  return (
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>Purchase document chain</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <ChainCard
            description={purchaseOrder ? formatDate(purchaseOrder.orderDate) : "Current order"}
            href={purchaseOrder ? `${ROUTES.purchasingOrders}/${purchaseOrder.id}` : undefined}
            icon={<FileText className="h-4 w-4" />}
            title={purchaseOrder?.purchaseOrderNumber ?? "Purchase order"}
          >
            {purchaseOrder ? <PurchaseOrderStatusBadge status={purchaseOrder.status} /> : null}
          </ChainCard>

          <div className="hidden items-center justify-center text-brand-mocha lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-3">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <ChainCard
                  description={`${formatDate(invoice.invoiceDate)} - ${formatCurrency(invoice.totalAmount)}`}
                  href={`${ROUTES.purchasingInvoices}/${invoice.id}`}
                  icon={<FileCheck2 className="h-4 w-4" />}
                  key={invoice.id}
                  title={invoice.invoiceNumber}
                >
                  <PurchaseInvoiceStatusBadge status={invoice.status} />
                  <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
                </ChainCard>
              ))
            ) : (
              <ChainCard
                description="Convert this PO to create a draft invoice."
                icon={<FileCheck2 className="h-4 w-4" />}
                title="No invoice yet"
              />
            )}
          </div>

          <div className="hidden items-center justify-center text-brand-mocha lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-3">
            {receipts.length > 0 ? (
              receipts.map((receipt) => (
                <ChainCard
                  description={formatDate(receipt.receivedDate)}
                  href={`${ROUTES.purchasingReceipts}/${receipt.id}`}
                  icon={<PackageCheck className="h-4 w-4" />}
                  key={receipt.id}
                  title={receipt.receiptNumber}
                >
                  <PurchaseReceiptStatusBadge status={receipt.status} />
                </ChainCard>
              ))
            ) : (
              <ChainCard
                description="Post an invoice, then convert it to a draft receipt."
                icon={<PackageCheck className="h-4 w-4" />}
                title="No receipt yet"
              />
            )}
          </div>

          <div className="hidden items-center justify-center text-brand-mocha lg:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-3">
            {payments.length > 0 ? (
              payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)
            ) : (
              <ChainCard
                description="Supplier payments appear here after invoice payment."
                icon={<ReceiptText className="h-4 w-4" />}
                title="No supplier payment yet"
              />
            )}
          </div>
        </div>

        {!hasNextSteps ? (
          <p className="mt-4 text-sm text-brand-mocha">
            Use the conversion actions to carry supplier, item, quantity, tax, and note details
            forward without re-entering them.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
