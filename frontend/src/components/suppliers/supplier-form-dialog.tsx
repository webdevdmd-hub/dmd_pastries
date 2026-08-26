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
  type CreateSupplierFormValues,
  createSupplierSchema,
} from "@/lib/validators/supplier.schema";
import type { CreateSupplierPayload, Supplier, UpdateSupplierPayload } from "@/types/supplier";

type SupplierFormDialogProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSupplierPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateSupplierPayload) => Promise<void>;
  open: boolean;
  supplier: Supplier | null;
};

function defaultValues(supplier: Supplier | null): CreateSupplierFormValues {
  return {
    supplierName: supplier?.supplierName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    website: supplier?.website ?? "",
    addressLine1: supplier?.addressLine1 ?? "",
    addressLine2: supplier?.addressLine2 ?? "",
    city: supplier?.city ?? "",
    state: supplier?.state ?? "",
    country: supplier?.country ?? "",
    postalCode: supplier?.postalCode ?? "",
    taxNumber: supplier?.taxNumber ?? "",
    notes: supplier?.notes ?? "",
  };
}

export function SupplierFormDialog({
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
  supplier,
}: SupplierFormDialogProps): JSX.Element {
  const form = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: defaultValues(supplier),
  });

  useEffect(() => {
    form.reset(defaultValues(supplier));
  }, [form, supplier]);

  const submit = async (values: CreateSupplierFormValues): Promise<void> => {
    const payload: CreateSupplierPayload = {
      supplierName: values.supplierName,
      phone: values.phone ?? null,
      email: values.email ?? null,
      website: values.website ?? null,
      addressLine1: values.addressLine1 ?? null,
      addressLine2: values.addressLine2 ?? null,
      city: values.city ?? null,
      state: values.state ?? null,
      country: values.country ?? null,
      postalCode: values.postalCode ?? null,
      taxNumber: values.taxNumber ?? null,
      notes: values.notes ?? null,
    };

    if (supplier) {
      await onUpdate(supplier.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreateSupplierFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>
            Manage supplier contact details, address, tax identity, and internal notes.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-6"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-2">Basic Information</h3>
            <div className="grid gap-2">
              <Label htmlFor="supplier-name">Supplier name</Label>
              <Input id="supplier-name" {...form.register("supplierName")} />
              {fieldError("supplierName") ? (
                <span className="text-sm text-danger-text">{fieldError("supplierName")}</span>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input id="supplier-phone" {...form.register("phone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input id="supplier-email" type="email" {...form.register("email")} />
              {fieldError("email") ? (
                <span className="text-sm text-danger-text">{fieldError("email")}</span>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-website">Website</Label>
              <Input
                id="supplier-website"
                placeholder="https://supplier.com"
                {...form.register("website")}
              />
              {fieldError("website") ? (
                <span className="text-sm text-danger-text">{fieldError("website")}</span>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-tax-number">Tax number / TRN</Label>
              <Input id="supplier-tax-number" {...form.register("taxNumber")} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-2">Address</h3>
            <Input placeholder="Address line 1" {...form.register("addressLine1")} />
            <Input placeholder="Address line 2" {...form.register("addressLine2")} />
            <Input placeholder="City" {...form.register("city")} />
            <Input placeholder="State" {...form.register("state")} />
            <Input placeholder="Country" {...form.register("country")} />
            <Input placeholder="Postal code" {...form.register("postalCode")} />
          </section>

          <section className="grid gap-2">
            <Label htmlFor="supplier-notes">Internal notes</Label>
            <textarea
              className="min-h-28 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
              id="supplier-notes"
              {...form.register("notes")}
            />
          </section>

          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : supplier ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
