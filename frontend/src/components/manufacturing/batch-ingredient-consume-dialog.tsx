"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

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
import { consumeSchema } from "@/lib/validators/manufacturing.schema";
import type { ConsumePayload, ProductionBatchIngredient } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

type ConsumeLine = {
  batchIngredientId: string;
  consumedQuantity: number;
};

function componentName(ingredient: ProductionBatchIngredient): string {
  return ingredient.componentProductName ?? ingredient.itemName;
}

function componentMeta(ingredient: ProductionBatchIngredient): string {
  const parts = [
    ingredient.componentProductType
      ? PRODUCT_TYPE_LABELS[ingredient.componentProductType]
      : "Legacy item",
    ingredient.componentVariantName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

export function BatchIngredientConsumeDialog({
  ingredients,
  isSubmitting,
  onClose,
  onConsume,
  open,
}: {
  ingredients: ProductionBatchIngredient[];
  isSubmitting: boolean;
  onClose: () => void;
  onConsume: (payload: ConsumePayload) => Promise<void>;
  open: boolean;
}): JSX.Element {
  const [lines, setLines] = useState<ConsumeLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLines(
      ingredients.map((ingredient) => ({
        batchIngredientId: ingredient.id,
        consumedQuantity: Math.max(ingredient.requiredQuantity - ingredient.consumedQuantity, 0),
      })),
    );
    setError(null);
  }, [ingredients, open]);

  const updateLine = (batchIngredientId: string, consumedQuantity: number): void => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.batchIngredientId === batchIngredientId ? { ...line, consumedQuantity } : line,
      ),
    );
  };

  const submit = async (): Promise<void> => {
    const payload = {
      lines: lines.filter((line) => line.consumedQuantity > 0),
    };
    const result = consumeSchema.safeParse(payload);

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check consumed quantities.");
      return;
    }

    await onConsume(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-7 py-6">
          <DialogTitle>Consume ingredients</DialogTitle>
          <DialogDescription>
            Record ingredient stock-out for this batch. Backend inventory validation is final.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(90vh-12rem)] space-y-3 overflow-y-auto px-7 py-6">
          {ingredients.map((ingredient) => {
            const line = lines.find((item) => item.batchIngredientId === ingredient.id);
            return (
              <div
                className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_160px]"
                key={ingredient.id}
              >
                <div>
                  <p className="font-semibold text-foreground">{componentName(ingredient)}</p>
                  <p className="text-xs text-foreground-muted">{componentMeta(ingredient)}</p>
                  <p className="text-sm text-foreground-muted">
                    Required {ingredient.requiredQuantity} {ingredient.unitSymbol}, consumed{" "}
                    {ingredient.consumedQuantity} {ingredient.unitSymbol}
                  </p>
                </div>
                <Input
                  aria-label={`Consumed quantity for ${componentName(ingredient)}`}
                  min="0"
                  onChange={(event) => updateLine(ingredient.id, Number(event.target.value))}
                  type="number"
                  value={line?.consumedQuantity ?? 0}
                />
              </div>
            );
          })}
          {error ? <p className="text-sm font-semibold text-danger-text">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border bg-muted px-7 py-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary"
            disabled={isSubmitting}
            onClick={() => void submit()}
            type="button"
          >
            Consume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
