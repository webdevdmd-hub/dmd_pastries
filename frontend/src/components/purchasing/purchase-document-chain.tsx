"use client";

import {
  ArrowRight,
  CircleDot,
  FileCheck2,
  FileText,
  PackageCheck,
  ReceiptText,
  RotateCcwSquare,
} from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
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
  isEmpty = false,
  stage,
  title,
}: {
  children?: ReactNode;
  description: string;
  href?: string | undefined;
  icon: ReactNode;
  isEmpty?: boolean;
  stage: string;
  title: string;
}): JSX.Element {
  const content = (
    <div
      className={cn(
        "h-full rounded-2xl border p-4 transition",
        isEmpty
          ? "border-dashed border-brand-cappuccino bg-brand-latte/40"
          : "border-brand-cappuccino bg-card hover:border-brand-caramel/70 hover:shadow-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-xl p-2",
            isEmpty ? "bg-card text-brand-mocha" : "bg-brand-latte text-brand-mocha",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold text-brand-mocha">{stage}</p>
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
      stage="Payment made"
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
        title="Unable to load purchase timeline"
      />
    );
  }

  const purchaseOrder = chain?.purchaseOrder ?? null;
  const invoices = chain?.purchaseInvoices ?? [];
  const receipts = chain?.purchaseReceipts ?? [];
  const purchaseReturns = chain?.purchaseReturns ?? [];
  const payments = chain?.supplierPayments ?? [];
  const hasNextSteps =
    invoices.length > 0 || receipts.length > 0 || purchaseReturns.length > 0 || payments.length > 0;
  const nextStep =
    invoices.length === 0
      ? "Convert this purchase order to a draft bill."
      : receipts.length === 0
        ? "Post the bill, then receive goods if stock has not been received."
        : payments.length === 0
          ? "Record payment made when the bill is ready to pay."
          : "This purchase timeline has linked downstream documents.";

  return (
    <Card className="overflow-hidden border-brand-cappuccino bg-card/90 shadow-sm">
      <CardHeader className="border-b border-brand-cappuccino bg-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold text-brand-mocha">Purchase timeline</p>
            <CardTitle className="mt-1 text-xl text-brand-espresso">Purchase Timeline</CardTitle>
            <p className="mt-2 text-sm text-brand-mocha">{nextStep}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand-cappuccino bg-brand-latte px-3 py-2 text-xs font-semibold text-brand-mocha">
            <CircleDot className="h-4 w-4" />
            {purchaseOrder?.purchaseOrderNumber ?? "Purchase order"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <ChainCard
            description={purchaseOrder ? formatDate(purchaseOrder.orderDate) : "Current order"}
            href={purchaseOrder ? `${ROUTES.purchasingOrders}/${purchaseOrder.id}` : undefined}
            icon={<FileText className="h-4 w-4" />}
            stage="Order"
            title={purchaseOrder?.purchaseOrderNumber ?? "Purchase order"}
          >
            {purchaseOrder ? <PurchaseOrderStatusBadge status={purchaseOrder.status} /> : null}
          </ChainCard>

          <div className="hidden items-center justify-center text-brand-mocha xl:flex">
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
                  stage="Bill"
                  title={invoice.supplierBillNumber ?? invoice.invoiceNumber}
                >
                  <PurchaseInvoiceStatusBadge status={invoice.status} />
                  <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
                </ChainCard>
              ))
            ) : (
              <ChainCard
                description="Convert this PO to create a draft bill."
                icon={<FileCheck2 className="h-4 w-4" />}
                isEmpty
                stage="Bill"
                title="No bill yet"
              />
            )}
          </div>

          <div className="hidden items-center justify-center text-brand-mocha xl:flex">
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
                  stage="Receive goods"
                  title={receipt.receiptNumber}
                >
                  <div className="flex flex-wrap gap-2">
                    <PurchaseReceiptStatusBadge status={receipt.status} />
                    <PurchaseReceiptAccountingBadge receipt={receipt} />
                  </div>
                  {receipt.accountingStatus === "pending_bill_posting" ? (
                    <p className="mt-2 text-xs text-brand-mocha">
                      {receipt.accountingStatusDetail}
                    </p>
                  ) : null}
                </ChainCard>
              ))
            ) : (
              <ChainCard
                description="Receive goods from the PO or from a posted bill when required."
                icon={<PackageCheck className="h-4 w-4" />}
                isEmpty
                stage="Receive goods"
                title="No receive record yet"
              />
            )}
          </div>

          <div className="hidden items-center justify-center text-brand-mocha xl:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-3">
            {purchaseReturns.length > 0 ? (
              purchaseReturns.map((purchaseReturn) => (
                <div className="grid gap-2" key={purchaseReturn.id}>
                  <ChainCard
                    description={`${formatDate(purchaseReturn.returnDate)} - ${formatCurrency(purchaseReturn.returnTotal)}`}
                    href={`${ROUTES.purchasingReturns}/${purchaseReturn.id}`}
                    icon={<RotateCcwSquare className="h-4 w-4" />}
                    stage="Vendor credit"
                    title={purchaseReturn.returnNumber}
                  >
                    <PurchaseReturnStatusBadge status={purchaseReturn.status} />
                    <Badge variant="secondary">
                      Open {formatCurrency(purchaseReturn.openCreditAmount)}
                    </Badge>
                  </ChainCard>
                  {purchaseReturn.reversalReturnId ? (
                    <ChainCard
                      description={purchaseReturn.reversalReason ?? "Linked reversal note"}
                      href={`${ROUTES.purchasingReturns}/${purchaseReturn.reversalReturnId}`}
                      icon={<RotateCcwSquare className="h-4 w-4" />}
                      stage="Reversal"
                      title={purchaseReturn.reversalReturnNumber ?? purchaseReturn.reversalReturnId}
                    >
                      <PurchaseReturnStatusBadge status="reversed" />
                    </ChainCard>
                  ) : null}
                </div>
              ))
            ) : (
              <ChainCard
                description="Vendor credits appear here when posted receipts are returned."
                icon={<RotateCcwSquare className="h-4 w-4" />}
                isEmpty
                stage="Vendor credit"
                title="No vendor credit"
              />
            )}
          </div>

          <div className="hidden items-center justify-center text-brand-mocha xl:flex">
            <ArrowRight className="h-4 w-4" />
          </div>

          <div className="grid gap-3">
            {payments.length > 0 ? (
              payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)
            ) : (
              <ChainCard
                description="Payments made appear here after bill payment."
                icon={<ReceiptText className="h-4 w-4" />}
                isEmpty
                stage="Payment made"
                title="No payment made yet"
              />
            )}
          </div>
        </div>

        {!hasNextSteps ? (
          <p className="mt-4 text-sm text-brand-mocha">
            Use the guided actions to carry supplier, item, quantity, tax, and note details forward
            without re-entering them.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
