"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { Controller, useForm } from "react-hook-form";

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
import { type AddPaymentSchema, addPaymentSchema } from "@/lib/validators/payment.schema";
import type { AddPaymentPayload } from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

type AddPaymentDialogProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (saleId: string, payload: AddPaymentPayload) => Promise<void>;
  open: boolean;
  paymentMethods: PaymentMethod[];
};

export function AddPaymentDialog({
  isSubmitting,
  onClose,
  onSubmit,
  open,
  paymentMethods,
}: AddPaymentDialogProps): JSX.Element {
  const form = useForm<AddPaymentSchema>({
    resolver: zodResolver(addPaymentSchema),
    defaultValues: {
      saleId: "",
      paymentMethodId: "",
      amount: 0,
      referenceNumber: null,
      providerTransactionId: null,
      notes: null,
    },
  });
  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.id === form.watch("paymentMethodId"),
  );

  const submitForm = async (values: AddPaymentSchema): Promise<void> => {
    const method = paymentMethods.find(
      (paymentMethod) => paymentMethod.id === values.paymentMethodId,
    );

    if (method?.requiresReference && !values.referenceNumber) {
      form.setError("referenceNumber", {
        message: "Reference number is required for this payment method.",
        type: "required",
      });
      return;
    }

    await onSubmit(values.saleId, {
      paymentMethodId: values.paymentMethodId,
      amount: values.amount,
      referenceNumber: values.referenceNumber ?? null,
      providerTransactionId: values.providerTransactionId ?? null,
      notes: values.notes ?? null,
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
          <DialogTitle>Add payment</DialogTitle>
          <DialogDescription>Add a remaining payment to a partial sale.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submitForm)(event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="saleId">Sale ID</Label>
            <Input id="saleId" {...form.register("saleId")} placeholder="sale_uuid_here" />
            <p className="text-xs text-danger-text">{form.formState.errors.saleId?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-payment-payment-method">Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="add-payment-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods
                      .filter((method) => method.status === "active")
                      .map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.methodName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-danger-text">
              {form.formState.errors.paymentMethodId?.message}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" min={0} step="0.01" type="number" {...form.register("amount")} />
            <p className="text-xs text-danger-text">{form.formState.errors.amount?.message}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="referenceNumber">
                Reference number{selectedPaymentMethod?.requiresReference ? " *" : ""}
              </Label>
              <Input id="referenceNumber" {...form.register("referenceNumber")} />
              <p className="text-xs text-danger-text">
                {form.formState.errors.referenceNumber?.message}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="providerTransactionId">Provider transaction ID</Label>
              <Input id="providerTransactionId" {...form.register("providerTransactionId")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" {...form.register("notes")} />
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Adding..." : "Add payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
