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
  RecipeProductOption,
  RecipeUnitOption,
} from "@/types/recipes";

function componentKey(line: {
  componentProductId: string | null;
  componentVariantId: string | null;
  inventoryItemId?: string;
}): string {
  return `${line.componentProductId ?? line.inventoryItemId ?? ""}:${line.componentVariantId ?? ""}`;
}

export function RecipeIngredientsSection({
  canManage,
  componentProducts,
  draftLines = [],
  onDraftLinesChange,
  recipeId,
  units,
}: {
  canManage: boolean;
  componentProducts: RecipeProductOption[];
  draftLines?: RecipeIngredientPayload[];
  onDraftLinesChange?: (lines: RecipeIngredientPayload[]) => void;
  recipeId: string | null;
  units: RecipeUnitOption[];
}): JSX.Element {
  const [editingLine, setEditingLine] = useState<RecipeIngredientLine | null>(null);
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const ingredientsQuery = useRecipeIngredients(recipeId, recipeId !== null);
  const addMutation = useAddRecipeIngredient();
  const updateMutation = useUpdateRecipeIngredient();
  const deleteMutation = useDeleteRecipeIngredient();
  const lines = ingredientsQuery.data ?? [];

  const draftLineToRecipeLine = (
    line: RecipeIngredientPayload,
    index: number,
  ): RecipeIngredientLine => {
    const item = componentProducts.find((component) => component.id === line.componentProductId);
    const variant =
      item?.variants.find((productVariant) => productVariant.id === line.componentVariantId) ??
      null;
    const unit = units.find((unitOption) => unitOption.id === line.unitId);

    return {
      id: `draft-${String(index)}`,
      componentProductId: line.componentProductId,
      componentProductName: item?.productName ?? null,
      componentProductType: item?.productType ?? null,
      componentVariantId: line.componentVariantId,
      componentVariantName: variant?.variantName ?? null,
      inventoryItemId: "",
      itemNameSnapshot: item?.productName ?? "Component product",
      notes: line.notes,
      quantityRequired: line.quantityRequired,
      sortOrder: line.sortOrder,
      totalCost: 0,
      unitCostSnapshot: 0,
      unitId: line.unitId,
      unitName: unit?.unitName ?? item?.unitName ?? "Unit",
      unitSymbol: unit?.unitSymbol ?? item?.unitSymbol ?? "",
      wastagePercentage: line.wastagePercentage,
    };
  };

  const saveLine = async (payload: RecipeIngredientPayload): Promise<void> => {
    if (!recipeId) {
      const duplicate = draftLines.some(
        (line, index) =>
          componentKey(line) === componentKey(payload) && index !== editingDraftIndex,
      );

      if (duplicate) {
        toast.error("This ingredient is already in the recipe.");
        return;
      }

      const nextLines =
        editingDraftIndex === null
          ? [...draftLines, payload]
          : draftLines.map((line, index) => (index === editingDraftIndex ? payload : line));
      onDraftLinesChange?.(nextLines);
      setEditingDraftIndex(null);
      setEditingLine(null);
      setEditorOpen(false);
      return;
    }

    const duplicate = lines.some(
      (line) => componentKey(line) === componentKey(payload) && line.id !== editingLine?.id,
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
    if (!recipeId && line.id.startsWith("draft-")) {
      const draftIndex = Number(line.id.replace("draft-", ""));
      onDraftLinesChange?.(draftLines.filter((_draftLine, index) => index !== draftIndex));
      return;
    }

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
        {canManage ? (
          <Button
            onClick={() => {
              setEditingDraftIndex(null);
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
            <p className="font-semibold text-brand-espresso">Build the ingredient BOM now.</p>
            <p className="mt-1 text-sm text-brand-mocha">
              Add all raw materials before saving. They will be attached when the recipe is saved.
            </p>
          </div>
        ) : null}
        {editorOpen ? (
          <RecipeIngredientLineEditor
            componentProducts={componentProducts}
            line={editingLine}
            onCancel={() => {
              setEditingDraftIndex(null);
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
        ) : !recipeId && draftLines.length > 0 ? (
          <RecipeIngredientTable
            canManage={canManage}
            lines={draftLines.map(draftLineToRecipeLine)}
            onDelete={(line) => {
              void deleteLine(line);
            }}
            onEdit={(line) => {
              const draftIndex = Number(line.id.replace("draft-", ""));
              setEditingDraftIndex(draftIndex);
              setEditingLine(line);
              setEditorOpen(true);
            }}
          />
        ) : recipeId ? (
          <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 text-sm text-brand-mocha">
            No ingredients added yet.
          </p>
        ) : (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino bg-white/70 p-4 text-sm text-brand-mocha">
            Add your first ingredient line to define what this recipe consumes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
