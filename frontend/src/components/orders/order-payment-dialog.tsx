"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { orderPaymentTypeLabel, resolveOrderPaymentType } from "@/lib/orders/payment-stage";
import {
  type OrderPaymentFormValues,
  type OrderPaymentInputValues,
  orderPaymentSchema,
} from "@/lib/validators/orders.schema";
import type { AddOrderPaymentPayload } from "@/types/orders";
import type { PaymentMethod } from "@/types/settings";

export function OrderPaymentDialog({
  balanceAmount,
  defaultPaymentMethodId,
  isSubmitting,
  methods,
  onClose,
  onSubmit,
  open,
  paidAmount,
}: {
  balanceAmount: number;
  defaultPaymentMethodId: string | null;
  isSubmitting: boolean;
  methods: PaymentMethod[];
  onClose: () => void;
  onSubmit: (payload: AddOrderPaymentPayload) => Promise<void>;
  open: boolean;
  paidAmount: number;
}): JSX.Element {
  const methodKey = methods.map((method) => method.id).join("|");
  const firstMethodId = methods[0]?.id ?? "";
  const methodIds = useMemo(
    () => new Set(methodKey.length > 0 ? methodKey.split("|") : []),
    [methodKey],
  );
  const resolvedDefaultPaymentMethodId =
    defaultPaymentMethodId && methodIds.has(defaultPaymentMethodId)
      ? defaultPaymentMethodId
      : firstMethodId;
  const initialPaymentType = resolveOrderPaymentType({
    balanceAmount,
    paidAmount,
    paymentAmount: 0,
  });
  const form = useForm<OrderPaymentInputValues, unknown, OrderPaymentFormValues>({
    defaultValues: {
      amount: 0,
      paymentMethodId: resolvedDefaultPaymentMethodId,
      paymentType: initialPaymentType,
      referenceNumber: null,
    },
    resolver: zodResolver(orderPaymentSchema),
  });
  const selectedPaymentMethodId = form.watch("paymentMethodId");
  const paymentAmount = form.watch("amount");
  const paymentType = resolveOrderPaymentType({
    balanceAmount,
    paidAmount,
    paymentAmount,
  });
  const selectedMethod = methods.find((method) => method.id === selectedPaymentMethodId);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      ...form.getValues(),
      paymentMethodId: resolvedDefaultPaymentMethodId,
      paymentType: resolveOrderPaymentType({
        balanceAmount,
        paidAmount,
        paymentAmount: form.getValues("amount"),
      }),
      referenceNumber: null,
    });
  }, [balanceAmount, form, open, paidAmount, resolvedDefaultPaymentMethodId]);

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add order payment</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              if (selectedMethod?.requiresReference && !values.referenceNumber) {
                form.setError("referenceNumber", {
                  message: "Reference number is required for this payment method.",
                  type: "required",
                });
                return;
              }
              const resolvedPaymentType = resolveOrderPaymentType({
                balanceAmount,
                paidAmount,
                paymentAmount: values.amount,
              });
              await onSubmit({ ...values, paymentType: resolvedPaymentType });
              form.reset({
                amount: 0,
                paymentMethodId: resolvedDefaultPaymentMethodId,
                paymentType: resolveOrderPaymentType({
                  balanceAmount,
                  paidAmount,
                  paymentAmount: 0,
                }),
                referenceNumber: null,
              });
            })(event);
          }}
        >
          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Select
              disabled={methods.length === 0}
              onValueChange={(value) =>
                form.setValue("paymentMethodId", value, { shouldValidate: true })
              }
              value={selectedPaymentMethodId}
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
            {methods.length === 0 ? (
              <p className="text-xs text-amber-700">
                No configured bakery payment methods are available.
              </p>
            ) : null}
            <p className="text-xs text-red-700">{form.formState.errors.paymentMethodId?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label>Payment stage</Label>
            <div className="rounded-xl border border-brand-cappuccino/70 bg-brand-latte/70 px-3 py-2 text-sm font-semibold text-brand-espresso">
              {orderPaymentTypeLabel(paymentType)}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orderPaymentAmount">Amount</Label>
            <Input
              id="orderPaymentAmount"
              min={0}
              step="0.01"
              type="number"
              {...form.register("amount", { valueAsNumber: true })}
            />
            <p className="text-xs text-red-700">{form.formState.errors.amount?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="orderPaymentReference">
              Reference number
              {selectedMethod?.requiresReference ? (
                <span aria-hidden="true" className="ml-1 text-red-700">
                  *
                </span>
              ) : null}
            </Label>
            <Input
              id="orderPaymentReference"
              placeholder={
                selectedMethod?.requiresReference
                  ? "Required for selected method"
                  : "Optional transaction reference"
              }
              {...form.register("referenceNumber")}
            />
            <p className="text-xs text-red-700">{form.formState.errors.referenceNumber?.message}</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting || methods.length === 0} type="submit">
              Add payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
