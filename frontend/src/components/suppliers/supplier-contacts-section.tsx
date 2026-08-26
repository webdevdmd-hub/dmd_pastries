"use client";

import { Edit, Plus, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, FailedState } from "@/components/shared/collection-state";
import { SupplierContactFormDialog } from "@/components/suppliers/supplier-contact-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    <Card>
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
          <div className="grid gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {/* A failed request used to render "No supplier contacts yet.", which
            reads as "this supplier has no contacts" when the truth is that we
            do not know. Empty and failed are different situations with opposite
            remedies. DESIGN.md §8. */}
        {!contactsQuery.isLoading && contactsQuery.error ? (
          <FailedState
            detail={getErrorMessage(contactsQuery.error)}
            noun="contacts"
            onRetry={() => {
              void contactsQuery.refetch();
            }}
          />
        ) : null}

        {!contactsQuery.isLoading && !contactsQuery.error && contacts.length === 0 ? (
          <EmptyState
            description="The person you call when an order is late. Add whoever answers the phone."
            {...(canManage
              ? {
                  action: {
                    label: "Add contact",
                    onClick: () => {
                      setEditingContact(null);
                      setFormOpen(true);
                    },
                  },
                }
              : {})}
            title="No contacts yet"
          />
        ) : null}

        {contacts.map((contact) => (
          <div className="rounded-lg border border-border p-4" key={contact.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{contact.contactName}</p>
                  {contact.isPrimary ? (
                    <Badge variant="info">
                      <Star aria-hidden="true" className="h-3 w-3" />
                      Primary
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-cell text-foreground-muted">
                  {contact.contactRole ?? "No role recorded"}
                </p>
                <p className="mt-2 text-cell tabular-nums">
                  {contact.phone ?? <span className="text-foreground-muted">&mdash;</span>}
                  <span className="text-foreground-muted"> · </span>
                  {contact.email ?? <span className="text-foreground-muted">&mdash;</span>}
                </p>
                {contact.notes ? (
                  <p className="mt-2 text-cell text-foreground-muted">{contact.notes}</p>
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
