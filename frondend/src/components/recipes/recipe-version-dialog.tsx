"use client";

import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

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
import { useCreateRecipeVersion, useRecipeVersions } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";

export function RecipeVersionDialog({
  onClose,
  open,
  recipeId,
}: {
  onClose: () => void;
  open: boolean;
  recipeId: string | null;
}): JSX.Element {
  const [changeNote, setChangeNote] = useState("");
  const versionsQuery = useRecipeVersions(recipeId, open && recipeId !== null);
  const createMutation = useCreateRecipeVersion();

  const createVersion = async (): Promise<void> => {
    if (!recipeId) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        id: recipeId,
        payload: { changeNote: changeNote.trim().length > 0 ? changeNote.trim() : null },
      });
      toast.success("Recipe version snapshot created.");
      setChangeNote("");
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create recipe version</DialogTitle>
          <DialogDescription>
            Save the current recipe as a version snapshot. This does not compare differences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Input
            aria-label="Version change note"
            onChange={(event) => setChangeNote(event.target.value)}
            placeholder="Change note"
            value={changeNote}
          />
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4">
            <p className="font-semibold text-brand-espresso">Previous versions</p>
            <div className="mt-3 space-y-2 text-sm text-brand-mocha">
              {(versionsQuery.data ?? []).slice(0, 5).map((version) => (
                <div className="flex justify-between gap-3" key={version.id}>
                  <span>Version {version.versionNumber}</span>
                  <span>{version.changeNote ?? "No note"}</span>
                </div>
              ))}
              {!versionsQuery.isLoading && (versionsQuery.data ?? []).length === 0 ? (
                <p>No versions created yet.</p>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={createMutation.isPending || recipeId === null}
            onClick={() => {
              void createVersion();
            }}
            type="button"
          >
            Create version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
