"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

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
import type { RefundOrderPaymentPayload } from "@/types/orders";
import type { PaymentMethod } from "@/types/settings";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function OrderRefundDialog({
  isCompleted,
  isSubmitting,
  methods,
  onClose,
  onSubmit,
  open,
  refundableAmount,
}: {
  isCompleted: boolean;
  isSubmitting: boolean;
  methods: PaymentMethod[];
  onClose: () => void;
  onSubmit: (payload: RefundOrderPaymentPayload) => Promise<void>;
  open: boolean;
  refundableAmount: number;
}): JSX.Element {
  const [amount, setAmount] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState(methods[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedMethod = methods.find((method) => method.id === paymentMethodId);

  useEffect(() => {
    if (open) {
      setAmount(0);
      setPaymentMethodId(methods[0]?.id ?? "");
      setReason("");
      setReferenceNumber("");
      setError(null);
    }
    // methods identity churns per render; keying on open is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (): Promise<void> => {
    if (!paymentMethodId) {
      setError("Select a payment method for the refund.");
      return;
    }
    if (!(amount > 0)) {
      setError("Refund amount must be greater than zero.");
      return;
    }
    if (amount > refundableAmount + 0.005) {
      setError(`Refund amount cannot exceed ${formatCurrency(refundableAmount)}.`);
      return;
    }
    if (reason.trim().length === 0) {
      setError("A reason is required for every refund.");
      return;
    }
    if (selectedMethod?.requiresReference && referenceNumber.trim().length === 0) {
      setError("Reference number is required for this payment method.");
      return;
    }
    setError(null);
    await onSubmit({
      amount,
      paymentMethodId,
      reason: reason.trim(),
      referenceNumber: referenceNumber.trim().length > 0 ? referenceNumber.trim() : null,
    });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund order payment</DialogTitle>
          <DialogDescription>
            {isCompleted
              ? "Refund money on this completed order. Revenue and VAT adjust proportionally."
              : "Return advance money held for this order."}{" "}
            Refundable: {formatCurrency(refundableAmount)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Refund method</Label>
            <Select
              disabled={methods.length === 0}
              onValueChange={setPaymentMethodId}
              value={paymentMethodId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.methodName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orderRefundAmount">Amount</Label>
            <Input
              id="orderRefundAmount"
              min={0}
              onChange={(event) => setAmount(Number(event.target.value))}
              step="0.01"
              type="number"
              value={Number.isFinite(amount) && amount !== 0 ? amount : ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orderRefundReason">Reason</Label>
            <Input
              id="orderRefundReason"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this money being returned?"
              value={reason}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orderRefundReference">
              Reference number
              {selectedMethod?.requiresReference ? (
                <span aria-hidden="true" className="ml-1 text-danger-text">
                  *
                </span>
              ) : null}
            </Label>
            <Input
              id="orderRefundReference"
              onChange={(event) => setReferenceNumber(event.target.value)}
              placeholder={
                selectedMethod?.requiresReference
                  ? "Required for selected method"
                  : "Optional transaction reference"
              }
              value={referenceNumber}
            />
          </div>
          {error ? <p className="text-xs text-danger-text">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isSubmitting || methods.length === 0}
            onClick={() => void submit()}
            type="button"
          >
            Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
