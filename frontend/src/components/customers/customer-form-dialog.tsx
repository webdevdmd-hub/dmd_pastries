"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CreateCustomerFormValues,
  createCustomerSchema,
} from "@/lib/validators/customer.schema";
import type {
  CreateCustomerPayload,
  Customer,
  CustomerGender,
  UpdateCustomerPayload,
} from "@/types/customer";

type CustomerFormDialogProps = {
  customer: Customer | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateCustomerPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateCustomerPayload) => Promise<void>;
  open: boolean;
};

function defaultValues(customer: Customer | null): CreateCustomerFormValues {
  return {
    fullName: customer?.fullName ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    dateOfBirth: customer?.dateOfBirth ?? "",
    gender: customer?.gender ?? null,
    addressLine1: customer?.addressLine1 ?? "",
    addressLine2: customer?.addressLine2 ?? "",
    city: customer?.city ?? "",
    state: customer?.state ?? "",
    country: customer?.country ?? "",
    postalCode: customer?.postalCode ?? "",
    notes: customer?.notes ?? "",
    tagIds: customer?.tags.map((tag) => tag.id) ?? [],
  };
}

export function CustomerFormDialog({
  customer,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
}: CustomerFormDialogProps): JSX.Element {
  const form = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: defaultValues(customer),
  });

  useEffect(() => {
    form.reset(defaultValues(customer));
  }, [customer, form]);

  const submit = async (values: CreateCustomerFormValues): Promise<void> => {
    const payload: CreateCustomerPayload = {
      fullName: values.fullName,
      phone: values.phone ?? null,
      email: values.email ?? null,
      dateOfBirth: values.dateOfBirth ?? null,
      gender: values.gender ?? null,
      addressLine1: values.addressLine1 ?? null,
      addressLine2: values.addressLine2 ?? null,
      city: values.city ?? null,
      state: values.state ?? null,
      country: values.country ?? null,
      postalCode: values.postalCode ?? null,
      notes: values.notes ?? null,
      tagIds: values.tagIds ?? [],
    };

    if (customer) {
      await onUpdate(customer.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreateCustomerFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Manage customer contact details, address, notes, and POS lookup readiness.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-6"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-bold text-brand-mocha">Basic Information</h3>
            <label className="grid gap-2">
              <Label htmlFor="customer-full-name">Full name</Label>
              <Input id="customer-full-name" {...form.register("fullName")} />
              {fieldError("fullName") ? (
                <span className="text-sm text-danger-text">{fieldError("fullName")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input id="customer-phone" {...form.register("phone")} />
              {fieldError("phone") ? (
                <span className="text-sm text-danger-text">{fieldError("phone")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input id="customer-email" type="email" {...form.register("email")} />
              {fieldError("email") ? (
                <span className="text-sm text-danger-text">{fieldError("email")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="customer-date-of-birth">Date of birth</Label>
              <Input id="customer-date-of-birth" type="date" {...form.register("dateOfBirth")} />
            </label>
            <label className="grid gap-2">
              <Label htmlFor="customer-form-gender">Gender</Label>
              <Select
                onValueChange={(value) =>
                  form.setValue("gender", value === "none" ? null : (value as CustomerGender))
                }
                value={form.watch("gender") ?? "none"}
              >
                <SelectTrigger id="customer-form-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-bold text-brand-mocha">Address</h3>
            <Input placeholder="Address line 1" {...form.register("addressLine1")} />
            <Input placeholder="Address line 2" {...form.register("addressLine2")} />
            <Input placeholder="City" {...form.register("city")} />
            <Input placeholder="State" {...form.register("state")} />
            <Input placeholder="Country" {...form.register("country")} />
            <Input placeholder="Postal code" {...form.register("postalCode")} />
          </section>

          <section className="grid gap-2">
            <Label htmlFor="customer-notes">Internal notes</Label>
            <textarea
              className="min-h-28 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
              id="customer-notes"
              {...form.register("notes")}
            />
          </section>

          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : customer ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
