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
import { useReceiptRecords } from "@/hooks/use-reports";
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

function formatOutstanding(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function last90Days(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: today.toISOString().slice(0, 10) };
}

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
  // Only sales that still owe something can take another payment, which is
  // what this dialog is for ("Add a remaining payment to a partial sale"), so
  // the picker asks for exactly those rather than every sale ever rung.
  const unsettledSalesQuery = useReceiptRecords(
    { ...last90Days(), limit: 100, paymentStatus: "partial" },
    open,
  );
  const unsettledSales = (unsettledSalesQuery.data ?? []).filter(
    (sale) => sale.totalAmount - sale.paidAmount > 0,
  );
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
          {/* A picker, not a UUID box.
              This asked for a raw "Sale ID" behind the placeholder
              "sale_uuid_here" -- a developer stub that shipped. A sale's UUID
              appears nowhere in the app (the screens show SALE-20260914-000001),
              so the only write action on the Payments page could not be used by
              the person it is for. It now lists the sales that actually owe
              money, which is the entire population this dialog serves.

              Regression: ISSUE-015 — Record payment demanded a sale UUID no operator can see
              Found by /qa on 2026-09-15 */}
          <div className="grid gap-2">
            <Label htmlFor="add-payment-sale">Sale</Label>
            <Controller
              control={form.control}
              name="saleId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger id="add-payment-sale">
                    <SelectValue
                      placeholder={
                        unsettledSalesQuery.isLoading ? "Loading sales…" : "Select a sale"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {unsettledSales.map((sale) => (
                      <SelectItem key={sale.saleId} value={sale.saleId}>
                        {`${sale.saleNumber} — ${sale.customerName || "Walk-in customer"} — ${formatOutstanding(
                          sale.totalAmount - sale.paidAmount,
                        )} outstanding`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!unsettledSalesQuery.isLoading && unsettledSales.length === 0 ? (
              <p className="text-xs text-foreground-muted">
                Every sale in the last 90 days is fully paid, so there is nothing to add a payment
                to.
              </p>
            ) : null}
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
