"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { RecipeIngredientLineEditor } from "@/components/recipes/recipe-ingredient-line-editor";
import { RecipeIngredientTable } from "@/components/recipes/recipe-ingredient-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAddRecipeIngredient,
  useDeleteRecipeIngredient,
  useRecipeIngredients,
  useUpdateRecipeIngredient,
} from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import type {
  RecipeIngredientLine,
  RecipeIngredientPayload,
  RecipeInventoryItemOption,
  RecipeUnitOption,
} from "@/types/recipes";

export function RecipeIngredientsSection({
  canManage,
  inventoryItems,
  onCreateRecipe,
  recipeId,
  savingRecipe,
  units,
}: {
  canManage: boolean;
  inventoryItems: RecipeInventoryItemOption[];
  onCreateRecipe?: () => void;
  recipeId: string | null;
  savingRecipe?: boolean;
  units: RecipeUnitOption[];
}): JSX.Element {
  const [editingLine, setEditingLine] = useState<RecipeIngredientLine | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const ingredientsQuery = useRecipeIngredients(recipeId, recipeId !== null);
  const addMutation = useAddRecipeIngredient();
  const updateMutation = useUpdateRecipeIngredient();
  const deleteMutation = useDeleteRecipeIngredient();
  const lines = ingredientsQuery.data ?? [];

  const saveLine = async (payload: RecipeIngredientPayload): Promise<void> => {
    if (!recipeId) {
      return;
    }

    const duplicate = lines.some(
      (line) => line.inventoryItemId === payload.inventoryItemId && line.id !== editingLine?.id,
    );

    if (duplicate) {
      toast.error("This ingredient is already in the recipe.");
      return;
    }

    try {
      if (editingLine) {
        await updateMutation.mutateAsync({ id: recipeId, lineId: editingLine.id, payload });
        toast.success("Ingredient line updated.");
      } else {
        await addMutation.mutateAsync({ id: recipeId, payload });
        toast.success("Ingredient line added.");
      }
      setEditingLine(null);
      setEditorOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteLine = async (line: RecipeIngredientLine): Promise<void> => {
    if (!recipeId) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ id: recipeId, lineId: line.id });
      toast.success("Ingredient line deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-white/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Ingredients BOM</CardTitle>
        {canManage && recipeId ? (
          <Button
            onClick={() => {
              setEditingLine(null);
              setEditorOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add ingredient
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {!recipeId ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="font-semibold text-brand-espresso">Create the recipe first.</p>
            <p className="mt-1 text-sm text-brand-mocha">
              Ingredient BOM lines need a saved recipe ID before they can be attached.
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
          <RecipeIngredientLineEditor
            inventoryItems={inventoryItems}
            line={editingLine}
            onCancel={() => {
              setEditingLine(null);
              setEditorOpen(false);
            }}
            onSubmit={saveLine}
            submitting={addMutation.isPending || updateMutation.isPending}
            units={units}
          />
        ) : null}
        {lines.length > 0 ? (
          <RecipeIngredientTable
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
            No ingredients added yet.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
