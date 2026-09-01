"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { supplierStatusHint } from "@/components/suppliers/supplier-status-copy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  type CreateSupplierFormValues,
  createSupplierSchema,
} from "@/lib/validators/supplier.schema";
import {
  type CreateSupplierPayload,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABEL,
  type Supplier,
  type SupplierStatus,
  type UpdateSupplierPayload,
} from "@/types/supplier";

type SupplierFormDialogProps = {
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSupplierPayload) => Promise<void>;
  /**
   * `status` is passed only when the Edit form changed it. It travels to a
   * different endpoint than the rest of the payload, so the caller fires two
   * mutations; the form does not know about either.
   */
  onUpdate: (id: string, payload: UpdateSupplierPayload, status?: SupplierStatus) => Promise<void>;
  open: boolean;
  supplier: Supplier | null;
};

/**
 * `PAYMENT_TERMS` carries "" as its not-set state (see types/supplier.ts), but
 * Radix reserves "" for "no selection" and throws if a SelectItem uses it. The
 * sentinel keeps the option selectable in the list; it is mapped back to "" on
 * the way into the form so the payload the backend sees is unchanged.
 */
const PAYMENT_TERMS_UNSET = "__unset";

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
    paymentTerms: supplier?.paymentTerms ?? "",
    // Kept as a string in the form: "" is unknown and "0" is same-day, and a
    // number input cannot hold that distinction.
    leadTimeDays: supplier?.leadTimeDays === null ? "" : String(supplier?.leadTimeDays ?? ""),
    isPreferred: supplier?.isPreferred ?? false,
  };
}

/** Marks a control the form will refuse to submit without. */
function RequiredMark(): JSX.Element {
  return (
    <span aria-hidden="true" className="text-danger-text">
      {" *"}
    </span>
  );
}

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <span className="text-meta text-danger-text" role="alert">
      {message}
    </span>
  );
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
  const [status, setStatus] = useState<SupplierStatus>(supplier?.status ?? "active");

  useEffect(() => {
    form.reset(defaultValues(supplier));
    setStatus(supplier?.status ?? "active");
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
      paymentTerms: values.paymentTerms,
      // "" is unknown, "0" is same-day. Only the empty box becomes null.
      leadTimeDays: values.leadTimeDays === "" ? null : Number(values.leadTimeDays),
      isPreferred: values.isPreferred,
    };

    if (supplier) {
      const statusChanged = status !== supplier.status;
      await onUpdate(supplier.id, payload, statusChanged ? status : undefined);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreateSupplierFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  const statusChanged = supplier ? status !== supplier.status : false;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>
            Contact details, address, and tax identity. Fields marked with an asterisk are required.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-6"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-meta text-foreground-muted md:col-span-2">Basics</h3>

            {/* These wrappers are <div>, not <label>. A <label> around a real
                <Label htmlFor> is nested-label markup, which is invalid and
                makes the outer one swallow clicks meant for the control. */}
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="supplier-name">
                Supplier name
                <RequiredMark />
              </Label>
              <Input
                aria-describedby={fieldError("supplierName") ? "supplier-name-error" : undefined}
                aria-invalid={fieldError("supplierName") ? true : undefined}
                aria-required="true"
                id="supplier-name"
                {...form.register("supplierName")}
              />
              <span id="supplier-name-error">
                <FieldError message={fieldError("supplierName")} />
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                aria-invalid={fieldError("phone") ? true : undefined}
                id="supplier-phone"
                inputMode="tel"
                placeholder="+971 4 000 0000"
                type="tel"
                {...form.register("phone")}
              />
              <FieldError message={fieldError("phone")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                aria-invalid={fieldError("email") ? true : undefined}
                id="supplier-email"
                inputMode="email"
                placeholder="orders@supplier.com"
                type="email"
                {...form.register("email")}
              />
              <FieldError message={fieldError("email")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-website">Website</Label>
              <Input
                aria-invalid={fieldError("website") ? true : undefined}
                id="supplier-website"
                inputMode="url"
                placeholder="https://supplier.com"
                {...form.register("website")}
              />
              <FieldError message={fieldError("website")} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-tax-number">Tax number / TRN</Label>
              <Input
                className="tabular-nums"
                id="supplier-tax-number"
                {...form.register("taxNumber")}
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-xl bg-muted p-4 md:grid-cols-2">
            <h3 className="text-meta text-foreground-muted md:col-span-2">Purchasing</h3>

            <div className="grid gap-2">
              <Label htmlFor="supplier-payment-terms">Payment terms</Label>
              <Select
                onValueChange={(next) =>
                  form.setValue(
                    "paymentTerms",
                    (next === PAYMENT_TERMS_UNSET
                      ? ""
                      : next) as CreateSupplierFormValues["paymentTerms"],
                    {
                      shouldDirty: true,
                    },
                  )
                }
                value={form.watch("paymentTerms") || PAYMENT_TERMS_UNSET}
              >
                <SelectTrigger aria-label="Payment terms" id="supplier-payment-terms">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((term) => (
                    <SelectItem
                      key={term || PAYMENT_TERMS_UNSET}
                      value={term || PAYMENT_TERMS_UNSET}
                    >
                      {PAYMENT_TERMS_LABEL[term]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-meta text-foreground-muted">
                Sets the due date on bills from this supplier.
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-lead-time">Lead time</Label>
              <div className="flex items-center gap-2">
                <Input
                  aria-invalid={fieldError("leadTimeDays") ? true : undefined}
                  className="w-24 tabular-nums"
                  id="supplier-lead-time"
                  inputMode="numeric"
                  placeholder="—"
                  {...form.register("leadTimeDays")}
                />
                {/* The unit is on the screen, not implied. A bare number in a
                    field called "lead time" is the ambiguity the audit flagged. */}
                <span className="text-cell text-foreground-muted">days to deliver</span>
              </div>
              <FieldError message={fieldError("leadTimeDays")} />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={form.watch("isPreferred")}
                  onCheckedChange={(checked) =>
                    form.setValue("isPreferred", checked === true, { shouldDirty: true })
                  }
                />
                <span className="text-cell font-medium">Preferred supplier</span>
              </label>
              <span className="text-meta text-foreground-muted">
                Ranked first when a purchase order line has more than one source.
              </span>
            </div>
          </section>

          {/* Status lives here as well as in the row menu. Someone who opens
              "Edit supplier" to change a supplier's status used to find every
              other field but that one, with nothing saying where it was. */}
          {supplier ? (
            <section className="grid gap-4 rounded-xl bg-muted p-4 md:grid-cols-2">
              <h3 className="text-meta text-foreground-muted md:col-span-2">Status</h3>
              <div className="grid gap-2">
                <Label htmlFor="supplier-status">Purchasing status</Label>
                <Select onValueChange={(next) => setStatus(next as SupplierStatus)} value={status}>
                  <SelectTrigger aria-label="Purchasing status" id="supplier-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="self-end text-cell text-foreground-muted">
                {supplierStatusHint(status)}
                {statusChanged ? " This changes when you save." : null}
              </p>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-meta text-foreground-muted md:col-span-2">Address</h3>

            {/* All six were bare placeholders with no label and no aria-label.
                A placeholder disappears the moment someone types, so a filled
                form showed six values with no field names. */}
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="supplier-address-1">Address line 1</Label>
              <Input id="supplier-address-1" {...form.register("addressLine1")} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="supplier-address-2">Address line 2</Label>
              <Input id="supplier-address-2" {...form.register("addressLine2")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-city">City</Label>
              <Input id="supplier-city" {...form.register("city")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-state">State or emirate</Label>
              <Input id="supplier-state" {...form.register("state")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-country">Country</Label>
              <Input id="supplier-country" {...form.register("country")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-postal-code">Postal code</Label>
              <Input
                className="tabular-nums"
                id="supplier-postal-code"
                {...form.register("postalCode")}
              />
            </div>
          </section>

          <section className="grid gap-2">
            <Label htmlFor="supplier-notes">Internal notes</Label>
            <textarea
              className="min-h-28 rounded-lg border border-border bg-card px-3 py-2 text-cell text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="supplier-notes"
              {...form.register("notes")}
            />
          </section>

          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving…" : supplier ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
