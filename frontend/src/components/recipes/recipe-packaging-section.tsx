"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { RecipePackagingLineEditor } from "@/components/recipes/recipe-packaging-line-editor";
import { RecipePackagingTable } from "@/components/recipes/recipe-packaging-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAddRecipePackaging,
  useDeleteRecipePackaging,
  useRecipePackaging,
  useUpdateRecipePackaging,
} from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import type {
  RecipePackagingLine,
  RecipePackagingOption,
  RecipePackagingPayload,
  RecipeUnitOption,
} from "@/types/recipes";

export function RecipePackagingSection({
  canManage,
  onCreateRecipe,
  packagingItems,
  recipeId,
  savingRecipe,
  units,
}: {
  canManage: boolean;
  onCreateRecipe?: () => void;
  packagingItems: RecipePackagingOption[];
  recipeId: string | null;
  savingRecipe?: boolean;
  units: RecipeUnitOption[];
}): JSX.Element {
  const [editingLine, setEditingLine] = useState<RecipePackagingLine | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const packagingQuery = useRecipePackaging(recipeId, recipeId !== null);
  const addMutation = useAddRecipePackaging();
  const updateMutation = useUpdateRecipePackaging();
  const deleteMutation = useDeleteRecipePackaging();
  const lines = packagingQuery.data ?? [];

  const saveLine = async (payload: RecipePackagingPayload): Promise<void> => {
    if (!recipeId) {
      return;
    }

    const duplicate = lines.some(
      (line) => line.packagingItemId === payload.packagingItemId && line.id !== editingLine?.id,
    );

    if (duplicate) {
      toast.error("This packaging item is already in the recipe.");
      return;
    }

    try {
      if (editingLine) {
        await updateMutation.mutateAsync({ id: recipeId, lineId: editingLine.id, payload });
        toast.success("Packaging line updated.");
      } else {
        await addMutation.mutateAsync({ id: recipeId, payload });
        toast.success("Packaging line added.");
      }
      setEditingLine(null);
      setEditorOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteLine = async (line: RecipePackagingLine): Promise<void> => {
    if (!recipeId) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ id: recipeId, lineId: line.id });
      toast.success("Packaging line deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-white/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Packaging BOM</CardTitle>
        {canManage && recipeId ? (
          <Button
            onClick={() => {
              setEditingLine(null);
              setEditorOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add packaging
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!recipeId ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="font-semibold text-brand-espresso">Create the recipe first.</p>
            <p className="mt-1 text-sm text-brand-mocha">
              Packaging BOM lines need a saved recipe ID before they can be attached.
            </p>
            {canManage && onCreateRecipe ? (
              <Button
                className="mt-4"
                disabled={savingRecipe}
                onClick={onCreateRecipe}
                type="button"
              >
                {savingRecipe ? "Creating recipe..." : "Create recipe first"}
              </Button>
            ) : null}
          </div>
        ) : null}
        {editorOpen ? (
          <RecipePackagingLineEditor
            line={editingLine}
            onCancel={() => {
              setEditingLine(null);
              setEditorOpen(false);
            }}
            onSubmit={saveLine}
            packagingItems={packagingItems}
            submitting={addMutation.isPending || updateMutation.isPending}
            units={units}
          />
        ) : null}
        {lines.length > 0 ? (
          <RecipePackagingTable
            canManage={canManage}
            lines={lines}
            onDelete={(line) => {
              void deleteLine(line);
            }}
            onEdit={(line) => {
              setEditingLine(line);
              setEditorOpen(true);
            }}
          />
        ) : recipeId ? (
          <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 text-sm text-brand-mocha">
            No packaging added yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
