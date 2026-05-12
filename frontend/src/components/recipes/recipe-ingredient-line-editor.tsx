"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ingredientLineSchema } from "@/lib/validators/recipes.schema";
import type {
  RecipeIngredientLine,
  RecipeIngredientPayload,
  RecipeInventoryItemOption,
  RecipeUnitOption,
} from "@/types/recipes";

type RecipeIngredientLineEditorProps = {
  inventoryItems: RecipeInventoryItemOption[];
  line: RecipeIngredientLine | null;
  onCancel: () => void;
  onSubmit: (payload: RecipeIngredientPayload) => Promise<void>;
  submitting: boolean;
  units: RecipeUnitOption[];
};

export function RecipeIngredientLineEditor({
  inventoryItems,
  line,
  onCancel,
  onSubmit,
  submitting,
  units,
}: RecipeIngredientLineEditorProps): JSX.Element {
  const [inventoryItemId, setInventoryItemId] = useState(line?.inventoryItemId ?? "");
  const [quantityRequired, setQuantityRequired] = useState(String(line?.quantityRequired ?? 1));
  const [unitId, setUnitId] = useState(line?.unitId ?? "");
  const [wastagePercentage, setWastagePercentage] = useState(String(line?.wastagePercentage ?? 0));
  const [notes, setNotes] = useState(line?.notes ?? "");
  const [sortOrder, setSortOrder] = useState(String(line?.sortOrder ?? 0));
  const selectedItem = inventoryItems.find((item) => item.id === inventoryItemId);

  useEffect(() => {
    if (selectedItem && unitId.length === 0) {
      setUnitId(selectedItem.unitId);
    }
  }, [selectedItem, unitId.length]);

  const submit = async (): Promise<void> => {
    const parsed = ingredientLineSchema.safeParse({
      inventoryItemId,
      notes,
      quantityRequired,
      sortOrder,
      unitId,
      wastagePercentage,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid ingredient line.");
      return;
    }

    await onSubmit(parsed.data);
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <Label>Ingredient</Label>
          <Select onValueChange={setInventoryItemId} value={inventoryItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Select ingredient" />
            </SelectTrigger>
            <SelectContent>
              {inventoryItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.itemName} - {item.unitSymbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-2">
          <Label>Unit</Label>
          <Select onValueChange={setUnitId} value={unitId}>
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.unitName} ({unit.unitSymbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="grid gap-2">
          <Label htmlFor="ingredient-qty">Quantity</Label>
          <Input
            id="ingredient-qty"
            min="0.01"
            onChange={(event) => setQuantityRequired(event.target.value)}
            step="0.01"
            type="number"
            value={quantityRequired}
          />
        </label>
        <label className="grid gap-2">
          <Label htmlFor="ingredient-wastage">Wastage %</Label>
          <Input
            id="ingredient-wastage"
            min="0"
            onChange={(event) => setWastagePercentage(event.target.value)}
            step="0.01"
            type="number"
            value={wastagePercentage}
          />
        </label>
        <label className="grid gap-2">
          <Label htmlFor="ingredient-sort">Sort order</Label>
          <Input
            id="ingredient-sort"
            min="0"
            onChange={(event) => setSortOrder(event.target.value)}
            step="1"
            type="number"
            value={sortOrder}
          />
        </label>
        <label className="grid gap-2">
          <Label htmlFor="ingredient-notes">Notes</Label>
          <Input
            id="ingredient-notes"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
      </div>
      <div className="flex justify-end gap-3">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={submitting}
          onClick={() => {
            void submit();
          }}
          type="button"
        >
          {line ? "Update line" : "Add line"}
        </Button>
      </div>
    </div>
  );
}
