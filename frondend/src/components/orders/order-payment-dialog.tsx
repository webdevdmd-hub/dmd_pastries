"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
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
import {
  type OrderPaymentFormValues,
  type OrderPaymentInputValues,
  orderPaymentSchema,
} from "@/lib/validators/orders.schema";
import type { AddOrderPaymentPayload } from "@/types/orders";
import type { PaymentMethod } from "@/types/settings";

export function OrderPaymentDialog({
  isSubmitting,
  methods,
  onClose,
  onSubmit,
  open,
}: {
  isSubmitting: boolean;
  methods: PaymentMethod[];
  onClose: () => void;
  onSubmit: (payload: AddOrderPaymentPayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const form = useForm<OrderPaymentInputValues, unknown, OrderPaymentFormValues>({
    resolver: zodResolver(orderPaymentSchema),
    values: { amount: 0, paymentMethodId: "", paymentType: "deposit", referenceNumber: null },
  });
  const selectedMethod = methods.find((method) => method.id === form.watch("paymentMethodId"));

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
              await onSubmit(values);
              form.reset();
            })(event);
          }}
        >
          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("paymentMethodId", value, { shouldValidate: true })
              }
              value={form.watch("paymentMethodId")}
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
            <p className="text-xs text-red-700">{form.formState.errors.paymentMethodId?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label>Payment type</Label>
            <Select
              onValueChange={(value: AddOrderPaymentPayload["paymentType"]) =>
                form.setValue("paymentType", value, { shouldValidate: true })
              }
              value={form.watch("paymentType")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="balance">Balance</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
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
            <Button disabled={isSubmitting} type="submit">
              Add payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
