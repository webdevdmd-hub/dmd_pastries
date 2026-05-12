"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PurchaseItemLineDraft,
  PurchaseItemType,
  PurchasingIngredientOption,
  PurchasingProductOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
} from "@/types/purchasing";

type PurchasingItemLineEditorProps = {
  allowBatchFields?: boolean;
  lines: PurchaseItemLineDraft[];
  onLinesChange: (lines: PurchaseItemLineDraft[]) => void;
  ingredients: PurchasingIngredientOption[];
  products: PurchasingProductOption[];
  taxRates: PurchasingTaxRateOption[];
  units: PurchasingUnitOption[];
};

function createLine(): PurchaseItemLineDraft {
  return {
    batchNumber: null,
    discountAmount: 0,
    expiryDate: null,
    ingredientId: null,
    itemType: "product",
    lineId: crypto.randomUUID(),
    packagingItemId: null,
    productId: null,
    quantity: 1,
    taxRateId: null,
    unitCost: 0,
    unitId: "",
  };
}

function updateLine(
  lines: PurchaseItemLineDraft[],
  lineId: string,
  patch: Partial<PurchaseItemLineDraft>,
): PurchaseItemLineDraft[] {
  return lines.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line));
}

function lineTotal(line: PurchaseItemLineDraft, taxRates: PurchasingTaxRateOption[]): number {
  const taxRate = taxRates.find((rate) => rate.id === line.taxRateId);
  const subtotal = line.quantity * line.unitCost - line.discountAmount;
  const tax = taxRate ? Math.max(subtotal, 0) * (taxRate.taxPercentage / 100) : 0;

  return Math.max(subtotal + tax, 0);
}

export function PurchasingItemLineEditor({
  allowBatchFields = false,
  lines,
  onLinesChange,
  ingredients,
  products,
  taxRates,
  units,
}: PurchasingItemLineEditorProps): JSX.Element {
  const safeLines = lines.length > 0 ? lines : [createLine()];

  return (
    <div className="space-y-3">
      {safeLines.map((line, index) => (
        <div
          className="rounded-2xl border border-brand-cappuccino/60 bg-white/75 p-4"
          key={line.lineId}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-brand-espresso">Item line {index + 1}</p>
            <Button
              aria-label={`Remove item line ${String(index + 1)}`}
              disabled={safeLines.length === 1}
              onClick={() => onLinesChange(safeLines.filter((item) => item.lineId !== line.lineId))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4 text-red-700" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              value={line.itemType}
              onValueChange={(itemType: PurchaseItemType) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, {
                    ingredientId: null,
                    itemType,
                    packagingItemId: null,
                    productId: null,
                    unitCost: 0,
                    unitId: "",
                  }),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="ingredient">Ingredient</SelectItem>
                <SelectItem value="packaging">Packaging placeholder</SelectItem>
              </SelectContent>
            </Select>
            {line.itemType === "ingredient" ? (
              <Select
                value={line.ingredientId ?? "none"}
                onValueChange={(ingredientId) => {
                  const selected = ingredients.find((ingredient) => ingredient.id === ingredientId);
                  onLinesChange(
                    updateLine(safeLines, line.lineId, {
                      ingredientId: ingredientId === "none" ? null : ingredientId,
                      unitCost: selected?.costPerUnit ?? line.unitCost,
                      unitId: selected?.unitId ?? line.unitId,
                    }),
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ingredient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select ingredient</SelectItem>
                  {ingredients.map((ingredient) => (
                    <SelectItem key={ingredient.id} value={ingredient.id}>
                      {ingredient.ingredientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={line.productId ?? "none"}
                onValueChange={(productId) =>
                  onLinesChange(
                    updateLine(safeLines, line.lineId, {
                      productId: productId === "none" ? null : productId,
                    }),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {line.itemType === "packaging" ? "Packaging item pending" : "Select product"}
                  </SelectItem>
                  {line.itemType === "product"
                    ? products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.productName}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            )}
            <Select
              value={line.unitId || "none"}
              onValueChange={(unitId) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, { unitId: unitId === "none" ? "" : unitId }),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select unit</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.unitName} ({unit.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Quantity"
              min="0"
              onChange={(event) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, { quantity: Number(event.target.value) }),
                )
              }
              placeholder="Quantity"
              type="number"
              value={line.quantity}
            />
            <Input
              aria-label="Unit cost"
              min="0"
              onChange={(event) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, { unitCost: Number(event.target.value) }),
                )
              }
              placeholder="Unit cost"
              type="number"
              value={line.unitCost}
            />
            <Input
              aria-label="Discount"
              min="0"
              onChange={(event) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, {
                    discountAmount: Number(event.target.value),
                  }),
                )
              }
              placeholder="Discount"
              type="number"
              value={line.discountAmount}
            />
            <Select
              value={line.taxRateId ?? "none"}
              onValueChange={(taxRateId) =>
                onLinesChange(
                  updateLine(safeLines, line.lineId, {
                    taxRateId: taxRateId === "none" ? null : taxRateId,
                  }),
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tax rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No tax</SelectItem>
                {taxRates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.taxName} ({rate.taxPercentage}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allowBatchFields ? (
              <>
                <Input
                  aria-label="Expiry date"
                  onChange={(event) =>
                    onLinesChange(
                      updateLine(safeLines, line.lineId, {
                        expiryDate: event.target.value || null,
                      }),
                    )
                  }
                  type="date"
                  value={line.expiryDate ?? ""}
                />
                <Input
                  aria-label="Batch number"
                  onChange={(event) =>
                    onLinesChange(
                      updateLine(safeLines, line.lineId, {
                        batchNumber: event.target.value || null,
                      }),
                    )
                  }
                  placeholder="Batch number"
                  value={line.batchNumber ?? ""}
                />
              </>
            ) : null}
          </div>
          <p className="mt-3 text-right text-sm font-semibold text-brand-espresso">
            Estimated line total: AED {lineTotal(line, taxRates).toFixed(2)}
          </p>
        </div>
      ))}
      <Button
        onClick={() => onLinesChange([...safeLines, createLine()])}
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        Add item line
      </Button>
    </div>
  );
}
