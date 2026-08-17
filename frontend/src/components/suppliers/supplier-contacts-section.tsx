"use client";

import { Edit, Plus, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { SupplierContactFormDialog } from "@/components/suppliers/supplier-contact-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateSupplierContact,
  useDeleteSupplierContact,
  useSupplierContacts,
  useUpdateSupplierContact,
} from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import type {
  CreateSupplierContactPayload,
  SupplierContact,
  UpdateSupplierContactPayload,
} from "@/types/supplier";

type SupplierContactsSectionProps = {
  canManage: boolean;
  supplierId: string;
};

export function SupplierContactsSection({
  canManage,
  supplierId,
}: SupplierContactsSectionProps): JSX.Element {
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const contactsQuery = useSupplierContacts(supplierId);
  const createMutation = useCreateSupplierContact();
  const updateMutation = useUpdateSupplierContact();
  const deleteMutation = useDeleteSupplierContact();
  const contacts = contactsQuery.data ?? [];

  const createContact = async (payload: CreateSupplierContactPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync({ supplierId, payload });
      toast.success("Supplier contact created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const updateContact = async (
    contactId: string,
    payload: UpdateSupplierContactPayload,
  ): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ supplierId, contactId, payload });
      toast.success("Supplier contact updated.");
      setEditingContact(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteContact = async (contactId: string): Promise<void> => {
    try {
      await deleteMutation.mutateAsync({ supplierId, contactId });
      toast.success("Supplier contact deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-card/80">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Contacts</CardTitle>
          {canManage ? (
            <Button
              onClick={() => {
                setEditingContact(null);
                setFormOpen(true);
              }}
              size="sm"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add contact
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contactsQuery.isLoading ? (
          <p className="text-sm text-brand-mocha">Loading contacts...</p>
        ) : null}
        {!contactsQuery.isLoading && contacts.length === 0 ? (
          <p className="text-sm text-brand-mocha">No supplier contacts yet.</p>
        ) : null}
        {contacts.map((contact) => (
          <div
            className="rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4"
            key={contact.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-brand-espresso">{contact.contactName}</p>
                  {contact.isPrimary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-caramel px-2 py-1 text-xs font-bold text-brand-latte">
                      <Star className="h-3 w-3" />
                      Primary
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-brand-mocha">
                  {contact.contactRole ?? "No role recorded"}
                </p>
                <p className="mt-2 text-sm text-brand-espresso">
                  {contact.phone ?? "No phone"} / {contact.email ?? "No email"}
                </p>
                {contact.notes ? (
                  <p className="mt-2 text-sm text-brand-mocha">{contact.notes}</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex gap-1">
                  <Button
                    aria-label="Edit contact"
                    onClick={() => {
                      setEditingContact(contact);
                      setFormOpen(true);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label="Delete contact"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void deleteContact(contact.id);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-danger-text" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>

      <SupplierContactFormDialog
        contact={editingContact}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingContact(null);
        }}
        onCreate={createContact}
        onUpdate={updateContact}
        open={formOpen}
      />
    </Card>
  );
}
