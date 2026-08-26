"use client";

import { Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, FailedState } from "@/components/shared/collection-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateSupplierNote,
  useDeleteSupplierNote,
  useSupplierNotes,
} from "@/hooks/use-suppliers";
import { getErrorMessage } from "@/lib/api/client";
import { createSupplierNoteSchema } from "@/lib/validators/supplier.schema";

type SupplierNotesSectionProps = {
  canManage: boolean;
  supplierId: string;
};

export function SupplierNotesSection({
  canManage,
  supplierId,
}: SupplierNotesSectionProps): JSX.Element {
  const [note, setNote] = useState("");
  const notesQuery = useSupplierNotes(supplierId);
  const createMutation = useCreateSupplierNote();
  const deleteMutation = useDeleteSupplierNote();

  const createNote = async (): Promise<void> => {
    const parsed = createSupplierNoteSchema.safeParse({ note });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid note.");
      return;
    }

    try {
      await createMutation.mutateAsync({ supplierId, payload: parsed.data });
      toast.success("Supplier note added.");
      setNote("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const notes = [...(notesQuery.data ?? [])].sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-3">
            <textarea
              aria-label="New supplier note"
              className="min-h-24 rounded-lg border border-border bg-card px-3 py-2 text-cell text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add an internal supplier note..."
              value={note}
            />
            <p className="text-meta tabular-nums text-foreground-muted">
              {note.length}/1000 characters
            </p>
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
          {notesQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}

          {/* Failed is not empty: a dropped request used to read as "this
              supplier has no notes". DESIGN.md §8. */}
          {!notesQuery.isLoading && notesQuery.error ? (
            <FailedState
              detail={getErrorMessage(notesQuery.error)}
              noun="notes"
              onRetry={() => {
                void notesQuery.refetch();
              }}
            />
          ) : null}

          {!notesQuery.isLoading && !notesQuery.error && notes.length === 0 ? (
            <EmptyState
              description="Anything your team should know before ordering: quality issues, delivery quirks, who to chase."
              title="No notes yet"
            />
          ) : null}
          {notes.map((supplierNote) => (
            <div className="rounded-lg border border-border p-4" key={supplierNote.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-cell">{supplierNote.note}</p>
                  <p className="mt-2 text-meta tabular-nums text-foreground-muted">
                    {supplierNote.createdByUserName} /{" "}
                    {supplierNote.createdAt
                      ? new Intl.DateTimeFormat("en-AE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(supplierNote.createdAt))
                      : "Unknown date"}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    aria-label="Delete note"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      void deleteMutation.mutateAsync({
                        supplierId,
                        noteId: supplierNote.id,
                      });
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-danger-text" />
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
