"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
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
import {
  type SupplierPaymentFormValues,
  type SupplierPaymentInputValues,
  supplierPaymentSchema,
} from "@/lib/validators/purchasing.schema";
import type { AddSupplierPaymentPayload } from "@/types/purchasing";
import type { PaymentMethod } from "@/types/settings";

type PurchaseSupplierPaymentDialogProps = {
  balanceAmount: number;
  description?: ReactNode;
  disabled?: boolean;
  invoiceNumber: string;
  invoiceSelector?: ReactNode;
  isSubmitting: boolean;
  methods: PaymentMethod[];
  onClose: () => void;
  onSubmit: (payload: AddSupplierPaymentPayload) => Promise<void>;
  open: boolean;
};

function toDatetimeLocalValue(date: Date): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function PurchaseSupplierPaymentDialog({
  balanceAmount,
  description,
  disabled = false,
  invoiceNumber,
  invoiceSelector,
  isSubmitting,
  methods,
  onClose,
  onSubmit,
  open,
}: PurchaseSupplierPaymentDialogProps): JSX.Element {
  const form = useForm<SupplierPaymentInputValues, unknown, SupplierPaymentFormValues>({
    defaultValues: {
      amount: 0,
      notes: null,
      paidAt: null,
      paymentMethodId: "",
      referenceNumber: null,
    },
    resolver: zodResolver(supplierPaymentSchema),
  });
  const selectedMethod = methods.find((method) => method.id === form.watch("paymentMethodId"));

  useEffect(() => {
    if (open) {
      form.reset({
        amount: balanceAmount > 0 ? balanceAmount : 0,
        notes: null,
        paidAt: null,
        paymentMethodId: "",
        referenceNumber: null,
      });
    }
  }, [balanceAmount, form, open]);

  const submitForm = async (values: SupplierPaymentFormValues): Promise<void> => {
    if (values.amount > balanceAmount) {
      form.setError("amount", {
        message: `Payment cannot exceed the balance amount.`,
        type: "max",
      });
      return;
    }

    if (selectedMethod?.requiresReference && !values.referenceNumber) {
      form.setError("referenceNumber", {
        message: "Reference number is required for this payment method.",
        type: "required",
      });
      return;
    }

    await onSubmit({
      amount: values.amount,
      notes: values.notes,
      paidAt: values.paidAt ? new Date(values.paidAt).toISOString() : null,
      paymentMethodId: values.paymentMethodId,
      referenceNumber: values.referenceNumber,
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
          <DialogTitle>Add supplier payment</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Record money paid out for {invoiceNumber}. Current balance is AED{" "}
                {balanceAmount.toFixed(2)}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submitForm)(event);
          }}
        >
          {invoiceSelector ? <div className="grid gap-2">{invoiceSelector}</div> : null}

          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <Select disabled={disabled} onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {methods
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
            <p className="text-xs text-red-700">{form.formState.errors.paymentMethodId?.message}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentAmount">Amount</Label>
              <Input
                id="supplierPaymentAmount"
                max={balanceAmount}
                min={0}
                step="0.01"
                type="number"
                disabled={disabled}
                {...form.register("amount")}
              />
              <p className="text-xs text-red-700">{form.formState.errors.amount?.message}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentPaidAt">Paid at</Label>
              <Input
                id="supplierPaymentPaidAt"
                disabled={disabled}
                type="datetime-local"
                {...form.register("paidAt")}
                placeholder={toDatetimeLocalValue(new Date())}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplierPaymentReference">
              Reference number{selectedMethod?.requiresReference ? " *" : ""}
            </Label>
            <Input
              id="supplierPaymentReference"
              disabled={disabled}
              placeholder={
                selectedMethod?.requiresReference
                  ? "Required for selected method"
                  : "Optional bank or transaction reference"
              }
              {...form.register("referenceNumber")}
            />
            <p className="text-xs text-red-700">{form.formState.errors.referenceNumber?.message}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="supplierPaymentNotes">Notes</Label>
            <Input
              id="supplierPaymentNotes"
              disabled={disabled}
              placeholder="Optional supplier payment note"
              {...form.register("notes")}
            />
          </div>

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={disabled || isSubmitting || balanceAmount <= 0} type="submit">
              {isSubmitting ? "Adding..." : "Add payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
