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
import { supplierPaymentErrorMessage } from "@/lib/purchasing/supplier-payment-errors";
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
  const hasPaymentMethods = methods.length > 0;
  const watchedPaymentAmount = form.watch("amount");
  const paymentAmount =
    typeof watchedPaymentAmount === "number" ? watchedPaymentAmount : Number(watchedPaymentAmount);
  const safePaymentAmount = Number.isFinite(paymentAmount) ? paymentAmount : 0;
  const remainingBalance = Math.max(balanceAmount - safePaymentAmount, 0);

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

  useEffect(() => {
    const selectedMethodId = form.getValues("paymentMethodId");
    if (!selectedMethodId) return;
    if (methods.some((method) => method.id === selectedMethodId)) return;

    form.setValue("paymentMethodId", "");
  }, [form, methods]);

  const submitForm = async (values: SupplierPaymentFormValues): Promise<void> => {
    if (!hasPaymentMethods) {
      form.setError("root", {
        message:
          "No active purchasing payment method is linked to a payment account for this branch. Update Payment Setup before saving payment.",
        type: "validate",
      });
      return;
    }

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

    try {
      await onSubmit({
        amount: values.amount,
        notes: values.notes,
        paidAt: values.paidAt ? new Date(values.paidAt).toISOString() : null,
        paymentMethodId: values.paymentMethodId,
        referenceNumber: values.referenceNumber,
      });
      form.reset();
    } catch (error) {
      form.setError("root", {
        message: supplierPaymentErrorMessage(error),
        type: "server",
      });
    }
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
          <DialogTitle>Record payment made</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Record money paid out for bill {invoiceNumber}. Current balance is AED{" "}
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

          <div className="grid gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
                Bill balance
              </p>
              <p className="mt-1 font-semibold text-brand-espresso">
                AED {balanceAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
                New payment
              </p>
              <p className="mt-1 font-semibold text-brand-espresso">
                AED {safePaymentAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-mocha">
                Remaining
              </p>
              <p className="mt-1 font-semibold text-brand-espresso">
                AED {remainingBalance.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <Select
                  disabled={disabled || !hasPaymentMethods}
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {hasPaymentMethods ? (
                      methods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.methodName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem disabled value="no-ready-methods">
                        No ready methods
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {hasPaymentMethods ? (
              <p className="text-xs text-red-700">
                {form.formState.errors.paymentMethodId?.message}
              </p>
            ) : (
              <p className="text-xs text-red-700">
                Set up an active purchasing payment method with a linked payment account for this
                branch.
              </p>
            )}
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
                {...form.register("amount", { valueAsNumber: true })}
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
            {form.formState.errors.root?.message ? (
              <p className="mr-auto text-sm text-red-700">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={disabled || isSubmitting || balanceAmount <= 0 || !hasPaymentMethods}
              type="submit"
            >
              {isSubmitting ? "Recording..." : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
