"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePaymentSummaryByMethod } from "@/hooks/use-payments";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";
import {
  type CreateReconciliationInputValues,
  type CreateReconciliationSchema,
  createReconciliationSchema,
} from "@/lib/validators/payment.schema";
import type { Branch } from "@/types/branch";
import type { CreateReconciliationPayload } from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

type ReconciliationFormDialogProps = {
  branches: Branch[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateReconciliationPayload) => Promise<void>;
  open: boolean;
  paymentMethods: PaymentMethod[];
};

export function ReconciliationFormDialog({
  branches,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  paymentMethods,
}: ReconciliationFormDialogProps): JSX.Element {
  const branchScope = useBranchScope();
  const activeBranches = useMemo(
    () =>
      branches.filter((branch) =>
        branchScope.canAccessAllBranches
          ? branch.status === "active"
          : branch.id === branchScope.effectiveBranchId,
      ),
    [branchScope.canAccessAllBranches, branchScope.effectiveBranchId, branches],
  );
  const form = useForm<CreateReconciliationInputValues, unknown, CreateReconciliationSchema>({
    resolver: zodResolver(createReconciliationSchema),
    defaultValues: {
      branchId: activeBranches[0]?.id ?? "",
      reconciliationDate: new Date().toISOString().slice(0, 10),
      paymentMethodId: "",
      countedAmount: "",
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        branchId: activeBranches[0]?.id ?? "",
        reconciliationDate: new Date().toISOString().slice(0, 10),
        paymentMethodId: "",
        countedAmount: "",
        notes: null,
      });
    }
  }, [activeBranches, form, open]);

  // The dialog exists to compare expected against counted, so the expected
  // figure has to be on screen while the cashier types. Same backend summary
  // the payments overview already reads.
  const timezone = useMemo(resolveDashboardTimezone, []);
  const selectedBranchId = form.watch("branchId");
  const selectedDate = form.watch("reconciliationDate");
  const selectedMethodId = form.watch("paymentMethodId");
  const countedAmount = form.watch("countedAmount");

  const summaryQuery = usePaymentSummaryByMethod(
    { branchId: selectedBranchId, date: selectedDate, timezone },
    open && Boolean(selectedBranchId) && Boolean(selectedDate),
  );

  // null means "we do not know yet" (no method picked, still loading, request
  // failed). A method with no row in the summary is NOT unknown — the backend
  // collected nothing on it, so expected is a real 0. Conflating the two hides
  // the variance on exactly the case worth flagging: cash counted on a day the
  // ledger says had no sales.
  const expectedAmount = useMemo(() => {
    if (!selectedMethodId || !summaryQuery.data) {
      return null;
    }

    const match = summaryQuery.data.find((entry) => entry.paymentMethodId === selectedMethodId);

    return match?.netAmount ?? 0;
  }, [selectedMethodId, summaryQuery.data]);

  const variance = useMemo(() => {
    const counted = Number(countedAmount);

    if (
      expectedAmount === null ||
      String(countedAmount).trim().length === 0 ||
      !Number.isFinite(counted)
    ) {
      return null;
    }

    return counted - expectedAmount;
  }, [countedAmount, expectedAmount]);

  const submitForm = async (values: CreateReconciliationSchema): Promise<void> => {
    await onSubmit({
      branchId: values.branchId,
      reconciliationDate: values.reconciliationDate,
      paymentMethodId: values.paymentMethodId,
      countedAmount: values.countedAmount,
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
          <DialogTitle>Create reconciliation</DialogTitle>
          <DialogDescription>
            Compare backend expected totals with counted cashier settlement.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submitForm)(event);
          }}
        >
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="reconciliation-form-branch">Branch</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="reconciliation-form-branch" aria-label="Branch">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-danger-text">{form.formState.errors.branchId?.message}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reconciliationDate">Date</Label>
              <Input id="reconciliationDate" type="date" {...form.register("reconciliationDate")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reconciliation-form-payment-method">Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    id="reconciliation-form-payment-method"
                    aria-label="Payment method"
                  >
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
          <div className="rounded-2xl border border-brand-cappuccino/70 bg-card/60 p-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Expected total</span>
              <span aria-live="polite" className="font-semibold">
                {!selectedMethodId
                  ? "Select a payment method"
                  : summaryQuery.isPending
                    ? "Loading..."
                    : summaryQuery.isError || expectedAmount === null
                      ? "Unavailable"
                      : formatAmount(expectedAmount)}
              </span>
            </div>
            {variance !== null ? (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Variance</span>
                <span
                  aria-live="polite"
                  className={
                    Math.abs(variance) < 0.005
                      ? "font-semibold text-success-text"
                      : "font-semibold text-danger-text"
                  }
                >
                  {Math.abs(variance) < 0.005
                    ? `Balanced (${formatAmount(0)})`
                    : `${variance > 0 ? "Over" : "Short"} ${formatAmount(Math.abs(variance))}`}
                </span>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="countedAmount">Counted amount</Label>
            <Input
              id="countedAmount"
              min={0}
              placeholder="0.00"
              step="0.01"
              type="number"
              {...form.register("countedAmount")}
            />
            <p className="text-xs text-danger-text">
              {form.formState.errors.countedAmount?.message}
            </p>
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
              {isSubmitting ? "Creating..." : "Create reconciliation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
