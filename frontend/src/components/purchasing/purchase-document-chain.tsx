"use client";

import {
  CircleDot,
  FileCheck2,
  FileText,
  PackageCheck,
  ReceiptText,
  RotateCcwSquare,
} from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { Fragment } from "react";

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

/**
 * One stage of the chain, as a row on a vertical rail.
 *
 * This used to be a column in a nine-track `xl:` grid. Breakpoints read the
 * viewport, not the box you are actually in, so on a 1440px desktop the nine
 * tracks still applied inside a 576px drawer: each stage got about 100px and
 * the cards overlapped each other. The horizontal chain was also what made the
 * timeline 2,002px tall -- five side-by-side columns all stretch to match the
 * tallest. A rail has no width to run out of.
 */
function ChainStep({
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
        "rounded-md border p-3 transition",
        isEmpty
          ? "border-dashed border-brand-cappuccino bg-brand-latte/40"
          : "border-brand-cappuccino bg-card hover:border-brand-caramel/70 hover:shadow-sm",
      )}
    >
      <p className="text-meta font-medium text-brand-mocha">{stage}</p>
      <p className="text-sm font-semibold text-brand-espresso">{title}</p>
      <p className="mt-1 text-xs text-brand-mocha">{description}</p>
      {children ? <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );

  return (
    <li className="relative pl-11">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border",
          isEmpty
            ? "border-dashed border-brand-cappuccino bg-card text-brand-mocha"
            : "border-brand-cappuccino bg-brand-latte text-brand-mocha",
        )}
      >
        {icon}
      </span>
      {href ? (
        <Link className="block" href={href}>
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

function PaymentCard({ payment }: { payment: SupplierPayment }): JSX.Element {
  return (
    <ChainStep
      description={`${formatDate(payment.paidAt)} - ${payment.paymentMethodName}`}
      icon={<ReceiptText className="h-4 w-4" />}
      stage="Payment made"
      title={payment.invoiceNumber}
    >
      <Badge variant="secondary">{formatCurrency(payment.amount)}</Badge>
      <PurchasePaymentStatusBadge
        status={payment.paymentStatus === "completed" ? "paid" : "unpaid"}
      />
    </ChainStep>
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
    <Card className="overflow-hidden border-brand-cappuccino bg-card shadow-sm">
      <CardHeader className="border-b border-brand-cappuccino bg-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {/* The eyebrow said "Purchase timeline" directly above a title
                reading "Purchase Timeline", and the drawer that holds this
                already names both the timeline and the order. One title. */}
            <CardTitle className="text-xl text-brand-espresso">Purchase Timeline</CardTitle>
            <p className="mt-2 text-sm text-brand-mocha">{nextStep}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand-cappuccino bg-brand-latte px-3 py-2 text-xs font-semibold text-brand-mocha">
            <CircleDot className="h-4 w-4" />
            {purchaseOrder?.purchaseOrderNumber ?? "Purchase order"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {/* The rail is one pseudo-element on the list, so it stays continuous
            whatever number of receipts, returns or payments a stage renders. */}
        <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-brand-cappuccino before:content-['']">
          <ChainStep
            description={purchaseOrder ? formatDate(purchaseOrder.orderDate) : "Current order"}
            href={purchaseOrder ? `${ROUTES.purchasingOrders}/${purchaseOrder.id}` : undefined}
            icon={<FileText className="h-4 w-4" />}
            stage="Order"
            title={purchaseOrder?.purchaseOrderNumber ?? "Purchase order"}
          >
            {purchaseOrder ? <PurchaseOrderStatusBadge status={purchaseOrder.status} /> : null}
          </ChainStep>

          {invoices.length > 0 ? (
            invoices.map((invoice) => (
              <ChainStep
                description={`${formatDate(invoice.invoiceDate)} - ${formatCurrency(invoice.totalAmount)}`}
                href={`${ROUTES.purchasingInvoices}/${invoice.id}`}
                icon={<FileCheck2 className="h-4 w-4" />}
                key={invoice.id}
                stage="Bill"
                title={invoice.supplierBillNumber ?? invoice.invoiceNumber}
              >
                <PurchaseInvoiceStatusBadge status={invoice.status} />
                <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
              </ChainStep>
            ))
          ) : (
            <ChainStep
              description="Convert this PO to create a draft bill."
              icon={<FileCheck2 className="h-4 w-4" />}
              isEmpty
              stage="Bill"
              title="No bill yet"
            />
          )}

          {receipts.length > 0 ? (
            receipts.map((receipt) => (
              <ChainStep
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
                  <p className="mt-2 text-xs text-brand-mocha">{receipt.accountingStatusDetail}</p>
                ) : null}
              </ChainStep>
            ))
          ) : (
            <ChainStep
              description="Receive goods from the PO or from a posted bill when required."
              icon={<PackageCheck className="h-4 w-4" />}
              isEmpty
              stage="Receive goods"
              title="No receive record yet"
            />
          )}

          {purchaseReturns.length > 0 ? (
            purchaseReturns.map((purchaseReturn) => (
              <Fragment key={purchaseReturn.id}>
                <ChainStep
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
                </ChainStep>
                {purchaseReturn.reversalReturnId ? (
                  <ChainStep
                    description={purchaseReturn.reversalReason ?? "Linked reversal note"}
                    href={`${ROUTES.purchasingReturns}/${purchaseReturn.reversalReturnId}`}
                    icon={<RotateCcwSquare className="h-4 w-4" />}
                    stage="Reversal"
                    title={purchaseReturn.reversalReturnNumber ?? purchaseReturn.reversalReturnId}
                  >
                    <PurchaseReturnStatusBadge status="reversed" />
                  </ChainStep>
                ) : null}
              </Fragment>
            ))
          ) : (
            <ChainStep
              description="Vendor credits appear here when posted receipts are returned."
              icon={<RotateCcwSquare className="h-4 w-4" />}
              isEmpty
              stage="Vendor credit"
              title="No vendor credit"
            />
          )}

          {payments.length > 0 ? (
            payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)
          ) : (
            <ChainStep
              description="Payments made appear here after bill payment."
              icon={<ReceiptText className="h-4 w-4" />}
              isEmpty
              stage="Payment made"
              title="No payment made yet"
            />
          )}
        </ol>

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
