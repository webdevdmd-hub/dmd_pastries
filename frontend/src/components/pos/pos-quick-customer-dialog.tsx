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
  type QuickCreateCustomerFormValues,
  quickCreateCustomerSchema,
} from "@/lib/validators/customer.schema";
import type { QuickCreateCustomerPayload } from "@/types/customer";

type POSQuickCustomerDialogProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: QuickCreateCustomerPayload) => Promise<void>;
  open: boolean;
};

export function POSQuickCustomerDialog({
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: POSQuickCustomerDialogProps): JSX.Element {
  const form = useForm<QuickCreateCustomerFormValues>({
    resolver: zodResolver(quickCreateCustomerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
    },
  });

  const submit = async (values: QuickCreateCustomerFormValues): Promise<void> => {
    await onSubmit({
      fullName: values.fullName,
      phone: values.phone ?? null,
      email: values.email ?? null,
    });
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick create customer</DialogTitle>
          <DialogDescription>
            Create a customer during billing and select them for this cart.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <label className="grid gap-2">
            <Label htmlFor="pos-customer-name">Full name</Label>
            <Input id="pos-customer-name" {...form.register("fullName")} />
            {form.formState.errors.fullName?.message ? (
              <span className="text-sm text-red-700">{form.formState.errors.fullName.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2">
            <Label htmlFor="pos-customer-phone">Phone</Label>
            <Input id="pos-customer-phone" {...form.register("phone")} />
            {form.formState.errors.phone?.message ? (
              <span className="text-sm text-red-700">{form.formState.errors.phone.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2">
            <Label htmlFor="pos-customer-email">Email</Label>
            <Input id="pos-customer-email" type="email" {...form.register("email")} />
            {form.formState.errors.email?.message ? (
              <span className="text-sm text-red-700">{form.formState.errors.email.message}</span>
            ) : null}
          </label>
          <p className="text-xs leading-5 text-brand-mocha">
            Phone or email is optional for quick walk-in capture, but recommended for future lookup.
            If an active customer already exists with the same contact, the backend returns that
            profile and it will be selected.
          </p>
          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
