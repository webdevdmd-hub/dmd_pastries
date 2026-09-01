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
      <DialogContent className="rounded-lg border-border bg-card text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-title">Quick create customer</DialogTitle>
          <DialogDescription className="text-foreground-muted">
            Create a customer during billing and select them for this cart.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="pos-customer-name">Full name</Label>
            <Input
              className="rounded-md border-border bg-card shadow-none focus-visible:ring-ring"
              id="pos-customer-name"
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName?.message ? (
              <span className="text-sm text-danger-text">
                {form.formState.errors.fullName.message}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pos-customer-phone">Phone</Label>
            <Input
              className="rounded-md border-border bg-card shadow-none focus-visible:ring-ring"
              id="pos-customer-phone"
              {...form.register("phone")}
            />
            {form.formState.errors.phone?.message ? (
              <span className="text-sm text-danger-text">
                {form.formState.errors.phone.message}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pos-customer-email">Email</Label>
            <Input
              className="rounded-md border-border bg-card shadow-none focus-visible:ring-ring"
              id="pos-customer-email"
              type="email"
              {...form.register("email")}
            />
            {form.formState.errors.email?.message ? (
              <span className="text-sm text-danger-text">
                {form.formState.errors.email.message}
              </span>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-foreground-muted">
            Phone or email is optional for quick walk-in capture, but recommended for future lookup.
            If an active customer already exists with the same contact, the backend returns that
            profile and it will be selected.
          </p>
          <DialogFooter>
            <Button
              className="rounded-md border-border bg-card text-foreground hover:bg-muted"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="rounded-md bg-primary text-primary-foreground hover:bg-primary"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating..." : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
