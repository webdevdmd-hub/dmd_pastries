"use client";

import { GripVertical, Package, Plus, Trash2 } from "lucide-react";
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

function lineNetAmount(line: PurchaseItemLineDraft): number {
  return Math.max(line.quantity * line.unitCost - line.discountAmount, 0);
}

function lineTaxAmount(line: PurchaseItemLineDraft, taxRates: PurchasingTaxRateOption[]): number {
  const taxRate = taxRates.find((rate) => rate.id === line.taxRateId);
  const taxableAmount = lineNetAmount(line);

  return taxRate ? taxableAmount * (taxRate.taxPercentage / 100) : 0;
}

function formatAmount(value: number): string {
  return value.toFixed(2);
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
  const safeLines = useMemo(() => (lines.length > 0 ? lines : [createLine()]), [lines]);
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
  const totals = useMemo(() => {
    const subtotal = safeLines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const discount = safeLines.reduce((sum, line) => sum + line.discountAmount, 0);
    const tax = safeLines.reduce((sum, line) => sum + lineTaxAmount(line, taxRates), 0);
    const total = safeLines.reduce((sum, line) => sum + lineTotal(line, taxRates), 0);

    return { discount, subtotal, tax, total };
  }, [safeLines, taxRates]);

  return (
    <section className="w-full rounded-xl border border-brand-cappuccino/70 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-brand-cappuccino/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-brand-mocha">Item Rates Are</span>
          <Select value="tax-exclusive">
            <SelectTrigger className="h-8 w-36 border-0 border-b border-dashed border-brand-mocha/40 bg-transparent px-0 text-xs font-semibold shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tax-exclusive">Tax Exclusive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-brand-mocha">
          Add purchase lines exactly as they should move through receiving and billing.
        </p>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs">
          <thead>
            <tr className="border-b border-brand-cappuccino/70 bg-brand-latte/30 text-left text-xs font-semibold text-brand-mocha">
              <th className="w-8 px-1.5 py-2" aria-label="Drag handle" />
              <th className="w-[310px] px-2 py-2">Item Details</th>
              <th className="w-[155px] px-2 py-2">Account</th>
              <th className="w-[100px] px-2 py-2 text-right">Quantity</th>
              <th className="w-[115px] px-2 py-2 text-right">Rate</th>
              <th className="w-[115px] px-2 py-2 text-right">Discount</th>
              <th className="w-[155px] px-2 py-2">Tax</th>
              <th className="w-[170px] px-2 py-2">Unit</th>
              <th className="w-[115px] px-2 py-2 text-right">Amount</th>
              <th className="w-[47px] px-1.5 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {safeLines.map((line, index) => {
              const selectedProduct =
                products.find((product) => product.id === line.productId) ?? null;
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
              const selectedTaxRate = taxRates.find((rate) => rate.id === line.taxRateId);

              return (
                <tr className="border-b border-brand-cappuccino/70 align-top" key={line.lineId}>
                  <td className="px-1.5 py-2 text-brand-mocha">
                    <GripVertical className="mt-2 h-4 w-4" />
                  </td>
                  <td className="bg-brand-latte/20 px-2 py-2">
                    <div className="space-y-2">
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
                                productVariantId:
                                  productVariantId.length === 0 ? null : productVariantId,
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
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-mocha">
                        <span className="inline-flex items-center gap-1 rounded bg-brand-cappuccino/60 px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-brand-espresso">
                          <Package className="h-3 w-3" />
                          {selectedProduct
                            ? PRODUCT_TYPE_LABELS[selectedProduct.productType]
                            : "Product"}
                        </span>
                        {selectedProduct?.productCode ? (
                          <span>{selectedProduct.productCode}</span>
                        ) : null}
                      </div>
                      {isLegacyLine ? (
                        <p className="text-xs text-amber-700">
                          Legacy item saved as {line.itemNameSnapshot ?? "purchase item"}. Select a
                          Product Master item before saving changes.
                        </p>
                      ) : null}
                      {allowBatchFields ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            aria-label="Batch number"
                            className="h-9"
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
                          <Input
                            aria-label="Expiry date"
                            className="h-9"
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
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="rounded-md border border-brand-cappuccino/70 bg-white px-2 py-1.5 text-xs font-semibold text-brand-espresso">
                      Inventory Asset
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={`Quantity for item line ${String(index + 1)}`}
                      className="h-9 text-right text-xs"
                      min="0"
                      onChange={(event) =>
                        onLinesChange(
                          updateLine(safeLines, line.lineId, {
                            quantity: Number(event.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={line.quantity}
                    />
                    {selectedProduct?.isStockTracked ? (
                      <p className="mt-1 text-right text-[11px] leading-4 text-brand-mocha">
                        Stock
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={`Rate for item line ${String(index + 1)}`}
                      className="h-9 text-right text-xs"
                      min="0"
                      onChange={(event) =>
                        onLinesChange(
                          updateLine(safeLines, line.lineId, {
                            unitCost: Number(event.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={line.unitCost}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      aria-label={`Discount for item line ${String(index + 1)}`}
                      className="h-9 text-right text-xs"
                      min="0"
                      onChange={(event) =>
                        onLinesChange(
                          updateLine(safeLines, line.lineId, {
                            discountAmount: Number(event.target.value),
                          }),
                        )
                      }
                      type="number"
                      value={line.discountAmount}
                    />
                  </td>
                  <td className="px-2 py-2">
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
                      <SelectTrigger className="h-9 text-xs">
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
                    {selectedTaxRate ? (
                      <p className="mt-1 text-[11px] text-brand-mocha">
                        Tax {formatAmount(lineTaxAmount(line, taxRates))}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
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
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-brand-espresso">
                    {formatAmount(lineNetAmount(line))}
                  </td>
                  <td className="px-1.5 py-2">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-brand-cappuccino/70 px-3 py-3 lg:grid-cols-[1fr_430px]">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="px-0 text-blue-700"
            onClick={() => onLinesChange([...safeLines, createLine()])}
            type="button"
            variant="link"
          >
            <Plus className="h-4 w-4" />
            Add another line
          </Button>
          <span className="text-brand-cappuccino">|</span>
          <Button
            className="px-0 text-blue-700"
            onClick={() => onLinesChange([...safeLines, createLine(), createLine(), createLine()])}
            type="button"
            variant="link"
          >
            <Plus className="h-4 w-4" />
            Add items in bulk
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-mocha">Sub Total</span>
            <span className="font-semibold text-brand-espresso">
              {formatAmount(totals.subtotal)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-6 border-t border-brand-cappuccino/60 pt-2">
            <div>
              <span className="text-brand-mocha">Discount</span>
              <p className="text-xs text-blue-700">Applied per line</p>
            </div>
            <span className="font-semibold text-red-700">-{formatAmount(totals.discount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-cappuccino/60 pt-2">
            <span className="text-brand-mocha">Tax</span>
            <span className="font-semibold text-brand-espresso">{formatAmount(totals.tax)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-brand-latte px-3 py-2 text-base">
            <span className="font-semibold text-brand-mocha">Total (AED)</span>
            <span className="text-lg font-bold text-brand-espresso">
              {formatAmount(totals.total)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
