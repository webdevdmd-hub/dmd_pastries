"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type RefundPaymentSchema, refundPaymentSchema } from "@/lib/validators/payment.schema";
import type { PaymentRefund, RefundPaymentPayload, SalePayment } from "@/types/payment";

export type RefundApproverOption = {
  id: string;
  label: string;
};

type PaymentRefundDialogProps = {
  approverOptions: RefundApproverOption[];
  canSelectApprover: boolean;
  currentUserId: string | null;
  currentUserName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (paymentId: string, payload: RefundPaymentPayload) => Promise<void>;
  open: boolean;
  payment: SalePayment | null;
  refunds: PaymentRefund[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PaymentRefundDialog({
  approverOptions,
  canSelectApprover,
  currentUserId,
  currentUserName,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  payment,
  refunds,
}: PaymentRefundDialogProps): JSX.Element {
  const refundedAmount = refunds
    .filter((refund) => refund.refundStatus !== "failed" && refund.refundStatus !== "cancelled")
    .reduce((total, refund) => total + refund.refundAmount, 0);
  const remainingRefundableAmount = Math.max((payment?.amount ?? 0) - refundedAmount, 0);
  const form = useForm<RefundPaymentSchema>({
    resolver: zodResolver(refundPaymentSchema),
    values: {
      refundAmount: remainingRefundableAmount,
      refundReason: "",
      approvedByUserId: currentUserId,
    },
  });
  const selectedApproverId = form.watch("approvedByUserId") ?? currentUserId ?? "";
  const resolvedApproverOptions =
    approverOptions.length > 0
      ? approverOptions
      : currentUserId
        ? [{ id: currentUserId, label: currentUserName }]
        : [];

  const submitForm = async (values: RefundPaymentSchema): Promise<void> => {
    if (!payment) {
      return;
    }

    if (values.refundAmount > remainingRefundableAmount) {
      form.setError("refundAmount", {
        message: `Maximum refundable amount is ${formatMoney(remainingRefundableAmount)}.`,
        type: "max",
      });
      return;
    }

    await onSubmit(payment.id, {
      refundAmount: values.refundAmount,
      refundReason: values.refundReason,
      approvedByUserId: values.approvedByUserId ?? null,
    });
    form.reset();
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund payment</DialogTitle>
          <DialogDescription>
            {payment
              ? `Refund up to ${formatMoney(remainingRefundableAmount)} from ${payment.saleNumber}.`
              : "Refund the selected payment."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submitForm)(event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="refundAmount">Refund amount</Label>
            <Input
              id="refundAmount"
              max={remainingRefundableAmount}
              min={0}
              step="0.01"
              type="number"
              {...form.register("refundAmount")}
            />
            <p className="text-xs text-brand-mocha">
              Maximum refundable amount: {formatMoney(remainingRefundableAmount)}.
            </p>
            <p className="text-xs text-danger-text">
              {form.formState.errors.refundAmount?.message}
            </p>
          </div>
          <div className="rounded-2xl border border-warning/30 bg-warning-tint p-3 text-sm text-warning-text">
            Refunds affect sale payment status and daily collection reports.
          </div>
          <div className="grid gap-2">
            <Label htmlFor="refundReason">Refund reason</Label>
            <Input
              id="refundReason"
              {...form.register("refundReason")}
              placeholder="Customer return, duplicate charge..."
            />
            <p className="text-xs text-danger-text">
              {form.formState.errors.refundReason?.message}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-refund-approved-by">Approved by</Label>
            <Select
              disabled={!canSelectApprover}
              onValueChange={(value) => form.setValue("approvedByUserId", value)}
              value={selectedApproverId}
            >
              <SelectTrigger id="payment-refund-approved-by">
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent>
                {resolvedApproverOptions.map((approver) => (
                  <SelectItem key={approver.id} value={approver.id}>
                    {approver.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-brand-mocha">
              {canSelectApprover
                ? "Owner/admin users can select an authorized approver."
                : "Your account is recorded as the refund approver for instant cashier refunds."}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || !payment || remainingRefundableAmount <= 0}
              type="submit"
            >
              {isSubmitting ? "Refunding..." : "Confirm refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
