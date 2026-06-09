"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useMemo } from "react";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type {
  PurchaseItemLineDraft,
  PurchasingProductOption,
  PurchasingTaxRateOption,
  PurchasingUnitOption,
} from "@/types/purchasing";

type PurchasingItemLineEditorProps = {
  allowBatchFields?: boolean;
  lines: PurchaseItemLineDraft[];
  onLinesChange: (lines: PurchaseItemLineDraft[]) => void;
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
    itemNameSnapshot: null,
    itemType: "product",
    lineId: crypto.randomUUID(),
    packagingItemId: null,
    productId: null,
    productVariantId: null,
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

function withSnapshotOption(
  options: SearchableComboboxOption[],
  selectedValue: string,
  snapshot: string | null | undefined,
): SearchableComboboxOption[] {
  const label = snapshot?.trim();

  if (
    selectedValue.length === 0 ||
    !label ||
    options.some((option) => option.value === selectedValue)
  ) {
    return options;
  }

  return [
    {
      description: "Saved purchase item",
      keywords: [label],
      label,
      value: selectedValue,
    },
    ...options,
  ];
}

export function PurchasingItemLineEditor({
  allowBatchFields = false,
  lines,
  onLinesChange,
  products,
  taxRates,
  units,
}: PurchasingItemLineEditorProps): JSX.Element {
  const safeLines = lines.length > 0 ? lines : [createLine()];
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.map((product) => ({
        description: [
          PRODUCT_TYPE_LABELS[product.productType],
          product.productCode,
          product.sku,
          product.unitSymbol,
        ]
          .filter(Boolean)
          .join(" / "),
        keywords: [
          product.productName,
          product.productCode,
          product.sku ?? "",
          product.barcode ?? "",
          PRODUCT_TYPE_LABELS[product.productType],
        ],
        label: product.productName,
        value: product.id,
      })),
    [products],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        description: unit.symbol,
        keywords: [unit.unitName, unit.symbol],
        label: `${unit.unitName} (${unit.symbol})`,
        value: unit.id,
      })),
    [units],
  );

  return (
    <div className="space-y-3">
      {safeLines.map((line, index) => {
        const selectedProduct = products.find((product) => product.id === line.productId) ?? null;
        const activeVariants =
          selectedProduct?.variants.filter((variant) => variant.status === "active") ?? [];
        const variantOptions = activeVariants.map((variant) => ({
          description: [variant.sku, variant.barcode].filter(Boolean).join(" / "),
          keywords: [variant.variantName, variant.sku ?? "", variant.barcode ?? ""],
          label: variant.variantName,
          value: variant.id,
        }));
        const isLegacyLine =
          line.itemType !== "product" || (!line.productId && Boolean(line.itemNameSnapshot));

        return (
          <div
            className="rounded-2xl border border-brand-cappuccino/60 bg-white/75 p-4"
            key={line.lineId}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand-espresso">Item line {index + 1}</p>
                {isLegacyLine ? (
                  <p className="text-xs text-amber-700">
                    Legacy item saved as {line.itemNameSnapshot ?? "purchase item"}. Select a
                    Product Master item before saving changes.
                  </p>
                ) : null}
              </div>
              <Button
                aria-label={`Remove item line ${String(index + 1)}`}
                disabled={safeLines.length === 1}
                onClick={() =>
                  onLinesChange(safeLines.filter((item) => item.lineId !== line.lineId))
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4 text-red-700" />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <SearchableCombobox
                emptyMessage="No matching Product Master items found."
                onValueChange={(productId) => {
                  const selected = products.find((product) => product.id === productId);
                  onLinesChange(
                    updateLine(safeLines, line.lineId, {
                      ingredientId: null,
                      itemNameSnapshot:
                        productId.length === 0 ? null : (selected?.productName ?? null),
                      itemType: "product",
                      packagingItemId: null,
                      productId: productId.length === 0 ? null : productId,
                      productVariantId: null,
                      unitCost: selected?.costPrice ?? line.unitCost,
                      unitId: selected?.unitId ?? line.unitId,
                    }),
                  );
                }}
                options={withSnapshotOption(
                  productOptions,
                  line.productId ?? "",
                  line.itemNameSnapshot,
                )}
                placeholder={line.itemNameSnapshot ?? "Select Product Master item"}
                searchPlaceholder="Search product, code, SKU, barcode..."
                value={line.productId ?? ""}
              />
              {selectedProduct && activeVariants.length > 0 ? (
                <SearchableCombobox
                  emptyMessage="No matching variants found."
                  onValueChange={(productVariantId) => {
                    const selectedVariant = activeVariants.find(
                      (variant) => variant.id === productVariantId,
                    );
                    onLinesChange(
                      updateLine(safeLines, line.lineId, {
                        itemNameSnapshot:
                          productVariantId.length === 0
                            ? selectedProduct.productName
                            : `${selectedProduct.productName} / ${selectedVariant?.variantName ?? "Variant"}`,
                        productVariantId: productVariantId.length === 0 ? null : productVariantId,
                        unitCost: selectedVariant?.costPrice ?? line.unitCost,
                      }),
                    );
                  }}
                  options={variantOptions}
                  placeholder="Select variant"
                  searchPlaceholder="Search variant, SKU, barcode..."
                  value={line.productVariantId ?? ""}
                />
              ) : null}
              <SearchableCombobox
                emptyMessage="No matching units found."
                onValueChange={(unitId) =>
                  onLinesChange(updateLine(safeLines, line.lineId, { unitId }))
                }
                options={unitOptions}
                placeholder="Select unit"
                searchPlaceholder="Search unit..."
                value={line.unitId}
              />
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha"
                  htmlFor={`purchase-line-${line.lineId}-quantity`}
                >
                  Quantity
                </label>
                <Input
                  aria-label="Quantity"
                  id={`purchase-line-${line.lineId}-quantity`}
                  min="0"
                  onChange={(event) =>
                    onLinesChange(
                      updateLine(safeLines, line.lineId, { quantity: Number(event.target.value) }),
                    )
                  }
                  placeholder="Enter quantity"
                  type="number"
                  value={line.quantity}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha"
                  htmlFor={`purchase-line-${line.lineId}-unit-cost`}
                >
                  Unit cost
                </label>
                <Input
                  aria-label="Unit cost"
                  id={`purchase-line-${line.lineId}-unit-cost`}
                  min="0"
                  onChange={(event) =>
                    onLinesChange(
                      updateLine(safeLines, line.lineId, { unitCost: Number(event.target.value) }),
                    )
                  }
                  placeholder="Cost per unit"
                  type="number"
                  value={line.unitCost}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha"
                  htmlFor={`purchase-line-${line.lineId}-discount`}
                >
                  Discount amount
                </label>
                <Input
                  aria-label="Discount amount"
                  id={`purchase-line-${line.lineId}-discount`}
                  min="0"
                  onChange={(event) =>
                    onLinesChange(
                      updateLine(safeLines, line.lineId, {
                        discountAmount: Number(event.target.value),
                      }),
                    )
                  }
                  placeholder="Optional discount"
                  type="number"
                  value={line.discountAmount}
                />
              </div>
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
        );
      })}
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
