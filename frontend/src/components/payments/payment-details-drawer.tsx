"use client";

import { ExternalLink, ReceiptText, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { isRefundablePayment } from "@/components/payments/payment-actions-menu";
import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import {
  formatPaymentDate,
  formatPaymentMoney,
  paymentSourceLabel,
} from "@/components/payments/payments-table";
import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { orderPaymentTypeLabel } from "@/lib/orders/payment-stage";
import type { PaymentRefund, SalePayment } from "@/types/payment";

type PaymentDetailsDrawerProps = {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  onOpenChange: (open: boolean) => void;
  onRefund: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  open: boolean;
  payment: SalePayment | null;
  refunds: PaymentRefund[];
};

type PaymentDetailTabKey = "details" | "refunds";

const PAYMENT_DETAIL_TABPANEL_ID = "payment-detail-tabpanel";

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * One payment's details in a sheet over the ledger, the way a customer's
 * details open over the customers list. The payment record is already on the
 * row, so the sheet needs no fetch of its own; the refunds against it come
 * from the host, which already holds the refunds list.
 */
export function PaymentDetailsDrawer({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onOpenChange,
  onRefund,
  onViewReceipt,
  open,
  payment,
  refunds,
}: PaymentDetailsDrawerProps): JSX.Element {
  // Radix requires a title in every dialog. The body renders the sale number;
  // the empty state names the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Payment details</SheetTitle>
      <SheetDescription>Details of the selected payment.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {payment ? (
          // Keyed by payment so switching payments resets the tab.
          <PaymentDetailsDrawerBody
            canRefund={canRefund}
            isReceiptLoading={isReceiptLoading}
            key={payment.id}
            onCreateReturn={onCreateReturn}
            onRefund={onRefund}
            onViewReceipt={onViewReceipt}
            payment={payment}
            refunds={refunds}
          />
        ) : (
          fallbackTitle
        )}
      </SheetContent>
    </Sheet>
  );
}

function PaymentDetailsDrawerBody({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onRefund,
  onViewReceipt,
  payment,
  refunds,
}: {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  onRefund: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  payment: SalePayment;
  refunds: PaymentRefund[];
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PaymentDetailTabKey>("details");
  const isPosSale = payment.sourceType === "pos_sale" && Boolean(payment.sourceId);
  const refundedAmount = refunds
    .filter((refund) => refund.refundStatus !== "failed" && refund.refundStatus !== "cancelled")
    .reduce((total, refund) => total + refund.refundAmount, 0);
  const remainingRefundableAmount = Math.max(payment.amount - refundedAmount, 0);
  const canReturn = canRefund && isRefundablePayment(payment) && remainingRefundableAmount > 0;

  const tabs: FormTab<PaymentDetailTabKey>[] = [
    { key: "details", label: "Details" },
    { key: "refunds", label: "Refunds", badge: refunds.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-mono text-page">{payment.sourceNumber}</SheetTitle>
          <PaymentStatusBadge status={payment.paymentStatus} />
        </div>
        <SheetDescription>
          {paymentSourceLabel(payment)} · {payment.customerName ?? "Walk-in customer"}
        </SheetDescription>
        <p className="text-kpi tabular-nums">{formatPaymentMoney(payment.amount)}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {isPosSale ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={`${ROUTES.payments}/sales/${payment.sourceId}`}>
                  <ExternalLink className="h-4 w-4" />
                  Open sale page
                </Link>
              </Button>
              <Button
                disabled={isReceiptLoading}
                onClick={() => onViewReceipt(payment)}
                size="sm"
                type="button"
                variant="outline"
              >
                <ReceiptText className="h-4 w-4" />
                Open receipt
              </Button>
            </>
          ) : null}
          {canReturn ? (
            <Button onClick={() => onCreateReturn(payment)} size="sm" type="button">
              <Undo2 className="h-4 w-4" />
              Return items
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <FormTabs
        active={activeTab}
        aria-label="Payment sections"
        onTabChange={setActiveTab}
        panelId={PAYMENT_DETAIL_TABPANEL_ID}
        tabs={tabs}
      />

      <div id={PAYMENT_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "details" ? (
          <div className="grid gap-4">
            <PaymentMethodBadge methodName={payment.paymentMethodNameSnapshot} />
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow label="Source" value={paymentSourceLabel(payment)} />
              <DetailRow label="Branch" value={payment.branchName} />
              <DetailRow label="Payment type" value={orderPaymentTypeLabel(payment.paymentType)} />
              <DetailRow label="Reference" value={payment.referenceNumber ?? "No reference"} />
              <DetailRow
                label="Provider transaction"
                value={payment.providerTransactionId ?? "Not recorded"}
              />
              <DetailRow label="Cashier" value={payment.paidByUserName} />
              <DetailRow label="Paid at" value={formatPaymentDate(payment.paidAt)} />
              <DetailRow
                label="Remaining refundable"
                value={formatPaymentMoney(remainingRefundableAmount)}
              />
            </div>
            <DetailRow label="Notes" value={payment.notes ?? "No notes"} />
            <DetailRow label="Payment ID" value={payment.id} />
          </div>
        ) : null}

        {activeTab === "refunds" ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
              <span className="text-meta text-foreground-muted">Refunded so far</span>
              <span className="text-cell font-medium tabular-nums">
                {formatPaymentMoney(refundedAmount)}
              </span>
            </div>
            {refunds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-cell text-foreground-muted">
                No refunds against this payment.
              </p>
            ) : (
              <div className="grid gap-3">
                {refunds.map((refund) => (
                  <div className="border-l-2 border-primary pl-3" key={refund.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-cell font-medium">{refund.refundNumber}</span>
                      <PaymentStatusBadge status={refund.refundStatus} />
                    </div>
                    <p className="text-cell tabular-nums">
                      {formatPaymentMoney(refund.refundAmount)} · {refund.refundReason}
                    </p>
                    <p className="text-meta tabular-nums text-foreground-muted">
                      {refund.createdByUserName} ·{" "}
                      {formatPaymentDate(refund.refundedAt ?? refund.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {canReturn ? (
              <Button
                className="w-fit"
                onClick={() => onRefund(payment)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4" />
                Legacy payment refund
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
