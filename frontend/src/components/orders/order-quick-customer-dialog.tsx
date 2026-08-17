"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import type { Customer } from "@/types/customer";

const quickCustomerSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email.")
    .or(z.literal(""))
    .transform((value) => value || null),
  fullName: z.string().trim().min(1, "Customer name is required."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

type QuickCustomerInput = z.input<typeof quickCustomerSchema>;
type QuickCustomerValues = z.output<typeof quickCustomerSchema>;

export function OrderQuickCustomerDialog({
  isSubmitting,
  onClose,
  onSubmit,
  open,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    email: string | null;
    fullName: string;
    phone: string | null;
  }) => Promise<Customer>;
  open: boolean;
}): JSX.Element {
  const form = useForm<QuickCustomerInput, unknown, QuickCustomerValues>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: { email: "", fullName: "", phone: "" },
  });

  return (
    <Dialog onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create customer</DialogTitle>
          <DialogDescription>
            Add a customer name and optional contact details for this order.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (values) => {
              await onSubmit(values);
              form.reset();
            })(event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="quickCustomerName">Full name</Label>
            <Input id="quickCustomerName" {...form.register("fullName")} />
            <p className="text-xs text-danger-text">{form.formState.errors.fullName?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quickCustomerPhone">Phone</Label>
            <Input id="quickCustomerPhone" {...form.register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quickCustomerEmail">Email</Label>
            <Input id="quickCustomerEmail" type="email" {...form.register("email")} />
            <p className="text-xs text-danger-text">{form.formState.errors.email?.message}</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              Create customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
