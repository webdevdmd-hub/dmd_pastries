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
import {
  type CreateReconciliationSchema,
  createReconciliationSchema,
} from "@/lib/validators/payment.schema";
import type { Branch } from "@/types/branch";
import type { CreateReconciliationPayload } from "@/types/payment";
import type { PaymentMethod } from "@/types/settings";

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
  const form = useForm<CreateReconciliationSchema>({
    resolver: zodResolver(createReconciliationSchema),
    defaultValues: {
      branchId: activeBranches[0]?.id ?? "",
      reconciliationDate: new Date().toISOString().slice(0, 10),
      paymentMethodId: "",
      countedAmount: 0,
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        branchId: activeBranches[0]?.id ?? "",
        reconciliationDate: new Date().toISOString().slice(0, 10),
        paymentMethodId: "",
        countedAmount: 0,
        notes: null,
      });
    }
  }, [activeBranches, form, open]);

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
              <Label>Branch</Label>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
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
              <p className="text-xs text-red-700">{form.formState.errors.branchId?.message}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reconciliationDate">Date</Label>
              <Input id="reconciliationDate" type="date" {...form.register("reconciliationDate")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Payment method</Label>
            <Controller
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
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
            <p className="text-xs text-red-700">{form.formState.errors.paymentMethodId?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="countedAmount">Counted amount</Label>
            <Input
              id="countedAmount"
              min={0}
              step="0.01"
              type="number"
              {...form.register("countedAmount")}
            />
            <p className="text-xs text-red-700">{form.formState.errors.countedAmount?.message}</p>
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
