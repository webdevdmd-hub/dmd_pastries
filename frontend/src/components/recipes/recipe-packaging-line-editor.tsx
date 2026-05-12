"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { packagingLineSchema } from "@/lib/validators/recipes.schema";
import type {
  RecipePackagingLine,
  RecipePackagingOption,
  RecipePackagingPayload,
  RecipeUnitOption,
} from "@/types/recipes";

type RecipePackagingLineEditorProps = {
  line: RecipePackagingLine | null;
  onCancel: () => void;
  onSubmit: (payload: RecipePackagingPayload) => Promise<void>;
  packagingItems: RecipePackagingOption[];
  submitting: boolean;
  units: RecipeUnitOption[];
};

export function RecipePackagingLineEditor({
  line,
  onCancel,
  onSubmit,
  packagingItems,
  submitting,
  units,
}: RecipePackagingLineEditorProps): JSX.Element {
  const [packagingItemId, setPackagingItemId] = useState(line?.packagingItemId ?? "");
  const [quantityRequired, setQuantityRequired] = useState(String(line?.quantityRequired ?? 1));
  const [unitId, setUnitId] = useState(line?.unitId ?? "");
  const [isOptional, setIsOptional] = useState(line?.isOptional ?? false);
  const [sortOrder, setSortOrder] = useState(String(line?.sortOrder ?? 0));
  const selectedItem = packagingItems.find((item) => item.id === packagingItemId);

  useEffect(() => {
    if (selectedItem && unitId.length === 0) {
      setUnitId(selectedItem.unitId);
    }
  }, [selectedItem, unitId.length]);

  const submit = async (): Promise<void> => {
    const parsed = packagingLineSchema.safeParse({
      isOptional,
      packagingItemId,
      quantityRequired,
      sortOrder,
      unitId,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid packaging line.");
      return;
    }

    await onSubmit(parsed.data);
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2">
          <Label>Packaging item</Label>
          <Select onValueChange={setPackagingItemId} value={packagingItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Select packaging item" />
            </SelectTrigger>
            <SelectContent>
              {packagingItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.packagingName}
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
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <Label htmlFor="packaging-qty">Quantity</Label>
          <Input
            id="packaging-qty"
            min="0.01"
            onChange={(event) => setQuantityRequired(event.target.value)}
            step="0.01"
            type="number"
            value={quantityRequired}
          />
        </label>
        <label className="grid gap-2">
          <Label htmlFor="packaging-sort">Sort order</Label>
          <Input
            id="packaging-sort"
            min="0"
            onChange={(event) => setSortOrder(event.target.value)}
            step="1"
            type="number"
            value={sortOrder}
          />
        </label>
        <label className="flex items-end gap-2 pb-3 text-sm font-medium text-brand-espresso">
          <Checkbox
            checked={isOptional}
            onCheckedChange={(checked) => setIsOptional(checked === true)}
          />
          Optional
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
