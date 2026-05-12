"use client";

import { Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateCustomerNote,
  useCustomerNotes,
  useDeleteCustomerNote,
} from "@/hooks/use-customers";
import { getErrorMessage } from "@/lib/api/client";
import { createCustomerNoteSchema } from "@/lib/validators/customer.schema";

type CustomerNotesSectionProps = {
  canManage: boolean;
  customerId: string;
};

export function CustomerNotesSection({
  canManage,
  customerId,
}: CustomerNotesSectionProps): JSX.Element {
  const [note, setNote] = useState("");
  const notesQuery = useCustomerNotes(customerId);
  const createMutation = useCreateCustomerNote();
  const deleteMutation = useDeleteCustomerNote();

  const createNote = async (): Promise<void> => {
    const parsed = createCustomerNoteSchema.safeParse({ note });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid note.");
      return;
    }

    try {
      await createMutation.mutateAsync({ customerId, payload: parsed.data });
      toast.success("Note added.");
      setNote("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const notes = [...(notesQuery.data ?? [])].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );

  return (
    <Card className="bg-white/80">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-3">
            <textarea
              aria-label="New customer note"
              className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add an internal customer note..."
              value={note}
            />
            <p className="text-xs text-brand-mocha">{note.length}/1000 characters</p>
            <Button
              className="w-fit"
              disabled={createMutation.isPending}
              onClick={() => {
                void createNote();
              }}
              type="button"
            >
              Add note
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-brand-mocha">No notes for this customer yet.</p>
          ) : null}
          {notes.map((customerNote) => (
            <div
              className="rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4"
              key={customerNote.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm leading-6 text-brand-espresso">{customerNote.note}</p>
                  <p className="mt-2 text-xs text-brand-mocha">
                    {customerNote.createdByUserName} ·{" "}
                    {customerNote.createdAt
                      ? new Intl.DateTimeFormat("en-AE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(customerNote.createdAt))
                      : "Unknown date"}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    aria-label="Delete note"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void deleteMutation.mutateAsync({
                        customerId,
                        noteId: customerNote.id,
                      });
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
