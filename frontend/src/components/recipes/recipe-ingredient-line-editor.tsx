"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecipeComponentProduct } from "@/lib/selectors/eligibility";
import { ingredientLineSchema } from "@/lib/validators/recipes.schema";
import { PRODUCT_TYPE_LABELS } from "@/types/product";
import type {
  RecipeIngredientLine,
  RecipeIngredientPayload,
  RecipeProductOption,
  RecipeUnitOption,
} from "@/types/recipes";

type RecipeIngredientLineEditorProps = {
  componentProducts: RecipeProductOption[];
  line: RecipeIngredientLine | null;
  onCancel: () => void;
  onDraftChange?: (payload: RecipeIngredientPayload | null) => void;
  onSubmit: (payload: RecipeIngredientPayload) => Promise<void>;
  parentProductId: string;
  submitting: boolean;
  units: RecipeUnitOption[];
};

export function RecipeIngredientLineEditor({
  componentProducts,
  line,
  onCancel,
  onDraftChange,
  onSubmit,
  parentProductId,
  submitting,
  units,
}: RecipeIngredientLineEditorProps): JSX.Element {
  const [componentProductId, setComponentProductId] = useState(line?.componentProductId ?? "");
  const [componentVariantId, setComponentVariantId] = useState(line?.componentVariantId ?? "");
  const [quantityRequired, setQuantityRequired] = useState(String(line?.quantityRequired ?? 1));
  const [unitId, setUnitId] = useState(line?.unitId ?? "");
  const [wastagePercentage, setWastagePercentage] = useState(String(line?.wastagePercentage ?? 0));
  const [notes, setNotes] = useState(line?.notes ?? "");
  const [sortOrder, setSortOrder] = useState(String(line?.sortOrder ?? 0));
  const selectedProduct = componentProducts.find((item) => item.id === componentProductId);
  const selectedVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);
  const selectedProductHasDefaultUnit = (selectedProduct?.unitId ?? "").length > 0;
  const shouldShowMissingUnitWarning =
    selectedProduct !== undefined && !selectedProductHasDefaultUnit && unitId.length === 0;
  const componentOptions = useMemo<SearchableComboboxOption[]>(
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
    const parsed = ingredientLineSchema.safeParse({
      componentProductId,
      componentVariantId,
      notes,
      quantityRequired,
      sortOrder,
      unitId,
      wastagePercentage,
    });

    onDraftChange?.(parsed.success ? parsed.data : null);
  }, [
    componentProductId,
    componentVariantId,
    notes,
    onDraftChange,
    quantityRequired,
    sortOrder,
    unitId,
    wastagePercentage,
  ]);

  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const submit = async (): Promise<void> => {
    const parsed = ingredientLineSchema.safeParse({
      componentProductId,
      componentVariantId,
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
        <div className="grid gap-2">
          <Label htmlFor="recipe-ingredient-line-editor-component-product">Component product</Label>
          <SearchableCombobox
            id="recipe-ingredient-line-editor-component-product"
            emptyMessage="No matching Product Master components found."
            onValueChange={(value) => {
              setComponentProductId(value);
              setComponentVariantId("");
              const nextProduct = componentProducts.find((item) => item.id === value);
              if (nextProduct) {
                setUnitId(nextProduct.unitId);
              }
            }}
            options={componentOptions}
            placeholder="Select component product"
            searchPlaceholder="Search product, type, variant..."
            value={componentProductId}
          />
          {!line?.componentProductId && line?.inventoryItemId ? (
            <span className="text-xs text-brand-mocha">
              Legacy ingredient: {line.itemNameSnapshot}. Select a Product Master component before
              saving changes.
            </span>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recipe-ingredient-line-editor-unit">Unit</Label>
          <SearchableCombobox
            id="recipe-ingredient-line-editor-unit"
            emptyMessage="No matching units found."
            onValueChange={setUnitId}
            options={unitOptions}
            placeholder="Select unit"
            searchPlaceholder="Search unit..."
            value={unitId}
          />
          {shouldShowMissingUnitWarning ? (
            <span className="text-xs text-danger-text">
              This product has no default unit configured. Select a unit before saving.
            </span>
          ) : selectedProduct ? (
            <span className="text-xs text-brand-mocha">
              Auto-filled from the selected product. Change only if this recipe consumes another
              unit.
            </span>
          ) : null}
        </div>
      </div>
      {selectedVariants.length > 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="recipe-ingredient-line-editor-component-variant">Component variant</Label>
          <SearchableCombobox
            id="recipe-ingredient-line-editor-component-variant"
            emptyMessage="No matching variants found."
            onValueChange={setComponentVariantId}
            options={variantOptions}
            placeholder="Parent product component"
            searchPlaceholder="Search variant, SKU..."
            value={componentVariantId}
          />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="ingredient-qty">Quantity</Label>
          <Input
            id="ingredient-qty"
            min="0.01"
            onChange={(event) => setQuantityRequired(event.target.value)}
            step="0.01"
            type="number"
            value={quantityRequired}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ingredient-wastage">Wastage %</Label>
          <Input
            id="ingredient-wastage"
            min="0"
            onChange={(event) => setWastagePercentage(event.target.value)}
            step="0.01"
            type="number"
            value={wastagePercentage}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ingredient-sort">Sort order</Label>
          <Input
            id="ingredient-sort"
            min="0"
            onChange={(event) => setSortOrder(event.target.value)}
            step="1"
            type="number"
            value={sortOrder}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ingredient-notes">Notes</Label>
          <Input
            id="ingredient-notes"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </div>
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
