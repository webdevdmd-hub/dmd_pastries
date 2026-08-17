"use client";

import { FileSearch, ReceiptText, RotateCcw, Undo2 } from "lucide-react";
import type { JSX } from "react";

import { PaymentMethodBadge } from "@/components/payments/payment-method-badge";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { orderPaymentTypeLabel } from "@/lib/orders/payment-stage";
import type { PaymentRefund, SalePayment } from "@/types/payment";

type PaymentDetailsDrawerProps = {
  canRefund: boolean;
  isReceiptLoading: boolean;
  onCreateReturn: (payment: SalePayment) => void;
  onOpenChange: (open: boolean) => void;
  onRefund: (payment: SalePayment) => void;
  onViewReceipt: (payment: SalePayment) => void;
  onViewSaleDetails: (payment: SalePayment) => void;
  open: boolean;
  payment: SalePayment | null;
  refunds: PaymentRefund[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-brand-cappuccino/70 bg-card/80 p-3">
      <p className="text-xs font-bold text-brand-mocha">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-espresso">{value}</p>
    </div>
  );
}

export function PaymentDetailsDrawer({
  canRefund,
  isReceiptLoading,
  onCreateReturn,
  onOpenChange,
  onRefund,
  onViewReceipt,
  onViewSaleDetails,
  open,
  payment,
  refunds,
}: PaymentDetailsDrawerProps): JSX.Element {
  const isRefundable =
    payment?.sourceType === "pos_sale" &&
    (payment.paymentStatus === "completed" || payment.paymentStatus === "partially_refunded");
  const refundedAmount = refunds
    .filter((refund) => refund.refundStatus !== "failed" && refund.refundStatus !== "cancelled")
    .reduce((total, refund) => total + refund.refundAmount, 0);
  const remainingRefundableAmount = Math.max((payment?.amount ?? 0) - refundedAmount, 0);
  const sourceLabel = payment?.sourceType === "bakery_order" ? "Bakery Order" : "POS Sale";

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-3xl">Payment details</SheetTitle>
          <SheetDescription>
            Customer collection details, source data, and refund actions where supported.
          </SheetDescription>
        </SheetHeader>

        {payment ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-3xl border border-brand-cappuccino/70 bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-brand-mocha">{payment.id}</p>
                  <h3 className="mt-1 text-2xl font-medium text-brand-espresso">
                    {payment.sourceNumber}
                  </h3>
                  <p className="mt-1 text-xs font-bold text-brand-mocha">{sourceLabel}</p>
                </div>
                <PaymentStatusBadge status={payment.paymentStatus} />
              </div>
              <p className="mt-4 text-3xl font-medium text-brand-espresso">
                {formatMoney(payment.amount)}
              </p>
            </div>

            <PaymentMethodBadge
              methodName={payment.paymentMethodNameSnapshot}
              methodType={payment.paymentMethodTypeSnapshot}
            />

            <div className="grid gap-3">
              <DetailRow label="Source Type" value={sourceLabel} />
              <DetailRow label="Source ID" value={payment.sourceId} />
              <DetailRow label="Customer" value={payment.customerName ?? "Walk-in customer"} />
              <DetailRow label="Branch" value={payment.branchName} />
              <DetailRow label="Payment Type" value={orderPaymentTypeLabel(payment.paymentType)} />
              <DetailRow label="Reference" value={payment.referenceNumber ?? "No reference"} />
              <DetailRow
                label="Provider transaction"
                value={payment.providerTransactionId ?? "Not recorded"}
              />
              <DetailRow label="Cashier" value={payment.paidByUserName} />
              <DetailRow label="Paid at" value={formatDate(payment.paidAt)} />
              <DetailRow label="Notes" value={payment.notes ?? "No notes"} />
              <DetailRow
                label="Remaining refundable"
                value={formatMoney(remainingRefundableAmount)}
              />
            </div>

            <div className="rounded-3xl border border-brand-cappuccino bg-brand-latte/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-brand-espresso">Refund history</h4>
                <span className="text-sm text-brand-mocha">
                  {formatMoney(refundedAmount)} refunded
                </span>
              </div>
              {refunds.length === 0 ? (
                <p className="mt-3 text-sm text-brand-mocha">No refunds yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {refunds.map((refund) => (
                    <div className="border-l-2 border-brand-caramel pl-3" key={refund.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-brand-espresso">
                          {refund.refundNumber}
                        </p>
                        <PaymentStatusBadge status={refund.refundStatus} />
                      </div>
                      <p className="text-sm text-brand-mocha">
                        {formatMoney(refund.refundAmount)} · {refund.refundReason}
                      </p>
                      <p className="text-xs text-brand-mocha">
                        {refund.createdByUserName} ·{" "}
                        {formatDate(refund.refundedAt ?? refund.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={payment.sourceType !== "pos_sale" || !payment.sourceId}
              onClick={() => onViewSaleDetails(payment)}
              type="button"
              variant="outline"
            >
              <FileSearch className="h-4 w-4" />
              View sale details
            </Button>

            <Button
              className="w-full"
              disabled={payment.sourceType !== "pos_sale" || !payment.sourceId || isReceiptLoading}
              onClick={() => onViewReceipt(payment)}
              type="button"
              variant="outline"
            >
              <ReceiptText className="h-4 w-4" />
              Open receipt
            </Button>

            {canRefund && isRefundable && remainingRefundableAmount > 0 ? (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => onCreateReturn(payment)} type="button">
                  <Undo2 className="h-4 w-4" />
                  Return items / create credit note
                </Button>
                <Button
                  className="w-full"
                  onClick={() => onRefund(payment)}
                  type="button"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4" />
                  Legacy payment refund
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
