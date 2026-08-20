"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecipeComponentProduct } from "@/lib/selectors/eligibility";
import { packagingLineSchema } from "@/lib/validators/recipes.schema";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type {
  RecipePackagingLine,
  RecipePackagingPayload,
  RecipeProductOption,
  RecipeUnitOption,
} from "@/types/recipes";

type RecipePackagingLineEditorProps = {
  componentProducts: RecipeProductOption[];
  line: RecipePackagingLine | null;
  onCancel: () => void;
  onDraftChange?: (payload: RecipePackagingPayload | null) => void;
  onSubmit: (payload: RecipePackagingPayload) => Promise<void>;
  parentProductId: string;
  submitting: boolean;
  units: RecipeUnitOption[];
};

export function RecipePackagingLineEditor({
  componentProducts,
  line,
  onCancel,
  onDraftChange,
  onSubmit,
  parentProductId,
  submitting,
  units,
}: RecipePackagingLineEditorProps): JSX.Element {
  const [componentProductId, setComponentProductId] = useState(line?.componentProductId ?? "");
  const [componentVariantId, setComponentVariantId] = useState(line?.componentVariantId ?? "");
  const [quantityRequired, setQuantityRequired] = useState(String(line?.quantityRequired ?? 1));
  const [unitId, setUnitId] = useState(line?.unitId ?? "");
  const [isOptional, setIsOptional] = useState(line?.isOptional ?? false);
  const [sortOrder, setSortOrder] = useState(String(line?.sortOrder ?? 0));
  const selectedProduct = componentProducts.find((item) => item.id === componentProductId);
  const selectedVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);
  const selectedProductHasDefaultUnit = (selectedProduct?.unitId ?? "").length > 0;
  const shouldShowMissingUnitWarning =
    selectedProduct !== undefined && !selectedProductHasDefaultUnit && unitId.length === 0;
  const packagingOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      componentProducts
        .filter((item) => isRecipeComponentProduct(item, parentProductId))
        .map((item) => ({
          value: item.id,
          label: item.productName,
          description: `${PRODUCT_TYPE_LABELS[item.productType]} · ${item.isStockTracked ? "Stock tracked" : "Not stock tracked"} · ${item.unitSymbol || item.unitName}`,
          keywords: [
            item.productName,
            item.productCode,
            item.sku ?? "",
            item.barcode ?? "",
            PRODUCT_TYPE_LABELS[item.productType],
            item.unitName,
            item.unitSymbol,
            ...item.variants.flatMap((variant) => [
              variant.variantName,
              variant.sku ?? "",
              variant.barcode ?? "",
            ]),
          ],
        })),
    [componentProducts, parentProductId],
  );
  const variantOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      selectedVariants.map((variant) => ({
        value: variant.id,
        label: variant.variantName,
        description: `AED ${variant.salePrice.toFixed(2)}${variant.sku ? ` · ${variant.sku}` : ""}`,
        keywords: [variant.variantName, variant.sku ?? "", String(variant.salePrice)],
      })),
    [selectedVariants],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: `${unit.unitName} (${unit.unitSymbol})`,
        description: unit.unitSymbol,
        keywords: [unit.unitName, unit.unitSymbol],
      })),
    [units],
  );

  useEffect(() => {
    if (selectedProduct && unitId.length === 0) {
      setUnitId(selectedProduct.unitId);
    }
  }, [selectedProduct, unitId.length]);

  useEffect(() => {
    const parsed = packagingLineSchema.safeParse({
      componentProductId,
      componentVariantId,
      isOptional,
      quantityRequired,
      sortOrder,
      unitId,
    });

    onDraftChange?.(parsed.success ? parsed.data : null);
  }, [
    componentProductId,
    componentVariantId,
    isOptional,
    onDraftChange,
    quantityRequired,
    sortOrder,
    unitId,
  ]);

  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const submit = async (): Promise<void> => {
    const parsed = packagingLineSchema.safeParse({
      componentProductId,
      componentVariantId,
      isOptional,
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
          <Label htmlFor="recipe-packaging-line-editor-packaging-product">Packaging product</Label>
          <SearchableCombobox
            id="recipe-packaging-line-editor-packaging-product"
            emptyMessage="No matching packaging products found."
            onValueChange={(value) => {
              setComponentProductId(value);
              setComponentVariantId("");
              const nextProduct = componentProducts.find((item) => item.id === value);
              if (nextProduct) {
                setUnitId(nextProduct.unitId);
              }
            }}
            options={packagingOptions}
            placeholder="Select packaging product"
            searchPlaceholder="Search packaging product..."
            value={componentProductId}
          />
          {!line?.componentProductId && line?.packagingItemId ? (
            <span className="text-xs text-brand-mocha">
              Legacy packaging: {line.packagingNameSnapshot}. Select a Product Master packaging
              product before saving changes.
            </span>
          ) : null}
        </label>
        <label className="grid gap-2">
          <Label htmlFor="recipe-packaging-line-editor-unit">Unit</Label>
          <SearchableCombobox
            id="recipe-packaging-line-editor-unit"
            emptyMessage="No matching units found."
            onValueChange={setUnitId}
            options={unitOptions}
            placeholder="Select unit"
            searchPlaceholder="Search unit..."
            value={unitId}
          />
          {shouldShowMissingUnitWarning ? (
            <span className="text-xs text-danger-text">
              This packaging product has no default unit configured. Select a unit before saving.
            </span>
          ) : selectedProduct ? (
            <span className="text-xs text-brand-mocha">
              Auto-filled from the selected packaging product. Change only if this recipe uses
              another unit.
            </span>
          ) : null}
        </label>
      </div>
      {selectedVariants.length > 0 ? (
        <label className="grid gap-2">
          <Label htmlFor="recipe-packaging-line-editor-packaging-variant">Packaging variant</Label>
          <SearchableCombobox
            id="recipe-packaging-line-editor-packaging-variant"
            emptyMessage="No matching variants found."
            onValueChange={setComponentVariantId}
            options={variantOptions}
            placeholder="Parent product packaging"
            searchPlaceholder="Search variant, SKU..."
            value={componentVariantId}
          />
        </label>
      ) : null}
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
