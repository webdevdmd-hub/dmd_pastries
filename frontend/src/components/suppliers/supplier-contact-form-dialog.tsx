"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
  type CreateSupplierContactFormValues,
  createSupplierContactSchema,
} from "@/lib/validators/supplier.schema";
import type {
  CreateSupplierContactPayload,
  SupplierContact,
  UpdateSupplierContactPayload,
} from "@/types/supplier";

type SupplierContactFormDialogProps = {
  contact: SupplierContact | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSupplierContactPayload) => Promise<void>;
  onUpdate: (contactId: string, payload: UpdateSupplierContactPayload) => Promise<void>;
  open: boolean;
};

function defaultValues(contact: SupplierContact | null): CreateSupplierContactFormValues {
  return {
    contactName: contact?.contactName ?? "",
    contactRole: contact?.contactRole ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    isPrimary: contact?.isPrimary ?? false,
    notes: contact?.notes ?? "",
  };
}

export function SupplierContactFormDialog({
  contact,
  isSubmitting,
  onClose,
  onCreate,
  onUpdate,
  open,
}: SupplierContactFormDialogProps): JSX.Element {
  const form = useForm<CreateSupplierContactFormValues>({
    resolver: zodResolver(createSupplierContactSchema),
    defaultValues: defaultValues(contact),
  });

  useEffect(() => {
    form.reset(defaultValues(contact));
  }, [contact, form]);

  const submit = async (values: CreateSupplierContactFormValues): Promise<void> => {
    const payload: CreateSupplierContactPayload = {
      contactName: values.contactName,
      contactRole: values.contactRole ?? null,
      phone: values.phone ?? null,
      email: values.email ?? null,
      isPrimary: values.isPrimary,
      notes: values.notes ?? null,
    };

    if (contact) {
      await onUpdate(contact.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreateSupplierContactFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            Store supplier contact people for purchasing and procurement follow-up.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          {/* These wrappers are <div>, not <label>. Each already contains a
              real <Label htmlFor>, and labels cannot nest: the outer one
              swallows clicks meant for the control it wraps. */}
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact-name">
              Contact name
              <span aria-hidden="true" className="text-danger-text">
                {" *"}
              </span>
            </Label>
            <Input
              aria-invalid={fieldError("contactName") ? true : undefined}
              aria-required="true"
              id="supplier-contact-name"
              {...form.register("contactName")}
            />
            {fieldError("contactName") ? (
              <span className="text-meta text-danger-text" role="alert">
                {fieldError("contactName")}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact-role">Role</Label>
            <Input id="supplier-contact-role" {...form.register("contactRole")} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact-phone">Phone</Label>
              <Input
                aria-invalid={fieldError("phone") ? true : undefined}
                id="supplier-contact-phone"
                inputMode="tel"
                placeholder="+971 4 000 0000"
                type="tel"
                {...form.register("phone")}
              />
              {fieldError("phone") ? (
                <span className="text-meta text-danger-text" role="alert">
                  {fieldError("phone")}
                </span>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-contact-email">Email</Label>
              <Input
                aria-invalid={fieldError("email") ? true : undefined}
                id="supplier-contact-email"
                inputMode="email"
                type="email"
                {...form.register("email")}
              />
              {fieldError("email") ? (
                <span className="text-meta text-danger-text" role="alert">
                  {fieldError("email")}
                </span>
              ) : null}
            </div>
          </div>
          {/* This one stays a <label>: it wraps the control directly with no
              nested <Label>, and Radix renders the checkbox as a <button>,
              which is a labelable element. */}
          <label className="flex items-center gap-3 rounded-lg bg-muted p-3">
            <Checkbox
              checked={form.watch("isPrimary")}
              onCheckedChange={(checked) => form.setValue("isPrimary", checked === true)}
            />
            <span className="text-cell font-medium">Primary contact</span>
          </label>
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact-notes">Notes</Label>
            <textarea
              className="min-h-24 rounded-lg border border-border bg-card px-3 py-2 text-cell text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="supplier-contact-notes"
              {...form.register("notes")}
            />
          </div>
          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving..." : contact ? "Save contact" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
