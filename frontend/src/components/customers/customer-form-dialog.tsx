"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
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

type CustomerFormTabKey = "details" | "address" | "notes";

const FORM_TABPANEL_ID = "customer-form-tabpanel";

/** Which tab each field lives on, so a validation error can open the right one. */
const FIELD_TABS: Record<keyof CreateCustomerFormValues, CustomerFormTabKey> = {
  fullName: "details",
  phone: "details",
  email: "details",
  dateOfBirth: "details",
  gender: "details",
  tagIds: "details",
  addressLine1: "address",
  addressLine2: "address",
  city: "address",
  state: "address",
  country: "address",
  postalCode: "address",
  notes: "notes",
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

/**
 * Create or edit a customer, in three tabs.
 *
 * One react-hook-form instance holds every field, and a tab only decides
 * which fields are rendered, so nothing typed on another tab is lost. A
 * failed submit switches to the first tab that has an error and badges each
 * tab with its error count, since a hidden error is otherwise a silent no-op.
 */
export function CustomerFormDialog({
  customer,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
}: CustomerFormDialogProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<CustomerFormTabKey>("details");
  const form = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: defaultValues(customer),
  });

  useEffect(() => {
    form.reset(defaultValues(customer));
  }, [customer, form]);

  // Every opening starts on Details, whichever tab the last one closed on.
  useEffect(() => {
    if (open) {
      setActiveTab("details");
    }
  }, [open]);

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

  const errors = form.formState.errors;
  const errorCount = (tab: CustomerFormTabKey): number =>
    (Object.keys(errors) as (keyof CreateCustomerFormValues)[]).filter(
      (field) => FIELD_TABS[field] === tab,
    ).length;

  const tabs: FormTab<CustomerFormTabKey>[] = [
    { key: "details", label: "Details", badge: errorCount("details") },
    { key: "address", label: "Address", badge: errorCount("address") },
    { key: "notes", label: "Notes", badge: errorCount("notes") },
  ];

  const fieldError = (name: keyof CreateCustomerFormValues): string | undefined => {
    const error = errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  const onInvalid = (invalid: typeof errors): void => {
    const firstField = (Object.keys(invalid) as (keyof CreateCustomerFormValues)[])[0];
    if (firstField) {
      setActiveTab(FIELD_TABS[firstField]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Contact details, address, and internal notes. Tags and status are managed from the
            customer's profile.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            void form.handleSubmit(submit, onInvalid)(event);
          }}
        >
          <div className="border-b border-border px-6 py-3">
            <FormTabs
              active={activeTab}
              aria-label="Customer form sections"
              onTabChange={setActiveTab}
              panelId={FORM_TABPANEL_ID}
              tabs={tabs}
            />
          </div>

          {/* One panel element that swaps. It is the only part that scrolls,
              so the tab strip and the footer stay in reach on a phone. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
            id={FORM_TABPANEL_ID}
            role="tabpanel"
            tabIndex={-1}
          >
            {activeTab === "details" ? (
              <section className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="customer-full-name">Full name</Label>
                  <Input id="customer-full-name" {...form.register("fullName")} />
                  {fieldError("fullName") ? (
                    <span className="text-sm text-danger-text">{fieldError("fullName")}</span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-phone">Phone</Label>
                  <Input id="customer-phone" inputMode="tel" {...form.register("phone")} />
                  {fieldError("phone") ? (
                    <span className="text-sm text-danger-text">{fieldError("phone")}</span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input id="customer-email" type="email" {...form.register("email")} />
                  {fieldError("email") ? (
                    <span className="text-sm text-danger-text">{fieldError("email")}</span>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-date-of-birth">Date of birth</Label>
                  <Input
                    id="customer-date-of-birth"
                    type="date"
                    {...form.register("dateOfBirth")}
                  />
                </div>
                <div className="grid gap-2">
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
                </div>
              </section>
            ) : null}

            {activeTab === "address" ? (
              <section className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="customer-address-1">Address line 1</Label>
                  <Input id="customer-address-1" {...form.register("addressLine1")} />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="customer-address-2">Address line 2</Label>
                  <Input id="customer-address-2" {...form.register("addressLine2")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-city">City</Label>
                  <Input id="customer-city" {...form.register("city")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-state">State</Label>
                  <Input id="customer-state" {...form.register("state")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-country">Country</Label>
                  <Input id="customer-country" {...form.register("country")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="customer-postal-code">Postal code</Label>
                  <Input id="customer-postal-code" {...form.register("postalCode")} />
                </div>
              </section>
            ) : null}

            {activeTab === "notes" ? (
              <section className="grid gap-2">
                <Label htmlFor="customer-notes">Internal notes</Label>
                <textarea
                  className="min-h-40 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
                  id="customer-notes"
                  {...form.register("notes")}
                />
                <p className="text-meta text-foreground-muted">
                  Seen by staff only. Dated notes with an author live on the profile's Notes tab.
                </p>
              </section>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4">
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
