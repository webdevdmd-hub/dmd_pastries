"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { ReorderLevelLabel } from "@/components/shared/reorder-level-help";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { type OpeningStockSchema, openingStockSchema } from "@/lib/validators/inventory.schema";
import type { Branch } from "@/types/branch";
import type { Ingredient } from "@/types/ingredient";
import type { InventoryItem, OpeningStockPayload, StockLocation } from "@/types/inventory";
import type { Unit } from "@/types/master-data";
import type { PackagingItem } from "@/types/packaging";
import type { Product } from "@/types/product";

type OpeningStockDialogProps = {
  branches: Branch[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: OpeningStockPayload) => Promise<void>;
  open: boolean;
  preselectedItem?: InventoryItem | null;
  ingredients: Ingredient[];
  packagingItems: PackagingItem[];
  products: Product[];
  stockLocations: StockLocation[];
  units: Unit[];
};

export function OpeningStockDialog({
  branches,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  preselectedItem = null,
  ingredients,
  packagingItems,
  products,
  stockLocations,
  units,
}: OpeningStockDialogProps): JSX.Element {
  const branchScope = useBranchScope();
  const activeBranches = useMemo(
    () =>
      branches.filter((branch) =>
        branchScope.canAccessAllBranches
          ? branch.status === "active"
          : branch.id === branchScope.effectiveBranchId,
      ),
    [branchScope.canAccessAllBranches, branchScope.effectiveBranchId, branches],
  );
  const defaultStockLocation = useMemo(
    () => stockLocations.find((location) => location.isDefault) ?? stockLocations[0] ?? null,
    [stockLocations],
  );
  const form = useForm<OpeningStockSchema>({
    resolver: zodResolver(openingStockSchema),
    defaultValues: {
      branchId: "",
      itemType: "product",
      productId: "",
      productVariantId: "",
      unitId: "",
      stockLocationId: "",
      quantity: 0,
      reorderLevel: 0,
      isExpiryTracked: false,
      expiryDate: "",
      reason: "",
    },
  });
  const itemType = form.watch("itemType");
  const selectedProductId = form.watch("productId") ?? "";
  const expiryTracked = form.watch("isExpiryTracked");
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const activeProductVariants = useMemo(
    () => selectedProduct?.variants.filter((variant) => variant.status === "active") ?? [],
    [selectedProduct],
  );
  const activeStockLocations = useMemo(
    () => stockLocations.filter((location) => location.status === "active"),
    [stockLocations],
  );
  const branchOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      activeBranches.map((branch) => ({
        value: branch.id,
        label: branch.name,
        description: branch.code,
        keywords: [branch.code, branch.status],
      })),
    [activeBranches],
  );
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.productName,
        description: [product.categoryName, product.sku, product.barcode, product.productCode]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" / "),
        keywords: [
          product.productName,
          product.productCode,
          product.categoryName,
          product.sku ?? "",
          product.barcode ?? "",
          product.status,
          ...product.variants.flatMap((variant) => [
            variant.variantName,
            variant.sku ?? "",
            variant.barcode ?? "",
          ]),
        ],
      })),
    [products],
  );
  const variantOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      activeProductVariants.map((variant) => ({
        value: variant.id,
        label: variant.variantName,
        description: [variant.sku, variant.barcode, `AED ${variant.salePrice.toFixed(2)}`]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" / "),
        keywords: [variant.variantName, variant.sku ?? "", variant.barcode ?? ""],
      })),
    [activeProductVariants],
  );
  const ingredientOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      ingredients.map((ingredient) => ({
        value: ingredient.id,
        label: ingredient.ingredientName,
        description: [ingredient.ingredientCategoryName, ingredient.unitName]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" / "),
        keywords: [
          ingredient.ingredientName,
          ingredient.ingredientCategoryName,
          ingredient.unitName,
          ingredient.supplierName ?? "",
        ],
      })),
    [ingredients],
  );
  const packagingOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      packagingItems.map((packagingItem) => ({
        value: packagingItem.id,
        label: packagingItem.packagingName,
        description: [packagingItem.packagingCategoryName, packagingItem.unitName]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" / "),
        keywords: [
          packagingItem.packagingName,
          packagingItem.packagingCategoryName,
          packagingItem.unitName,
          packagingItem.supplierName ?? "",
        ],
      })),
    [packagingItems],
  );
  const stockLocationOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      activeStockLocations.map((location) => ({
        value: location.id,
        label: location.locationName,
        description: [
          location.locationCode,
          location.locationType,
          location.isDefault ? "Default" : "",
        ]
          .filter((part) => part.length > 0)
          .join(" / "),
        keywords: [location.locationName, location.locationCode, location.locationType],
      })),
    [activeStockLocations],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: `${unit.unitName} (${unit.symbol})`,
        description: unit.symbol,
        keywords: [unit.unitName, unit.symbol],
      })),
    [units],
  );

  useEffect(() => {
    if (open) {
      const itemType = preselectedItem?.itemType ?? "product";
      const productId = preselectedItem?.productId ?? "";
      const ingredientId = preselectedItem?.ingredientId ?? "";
      const packagingItemId = preselectedItem?.packagingItemId ?? "";
      const selectedProduct = products.find((product) => product.id === productId);
      const selectedVariant = selectedProduct?.variants.find(
        (variant) => variant.id === preselectedItem?.productVariantId,
      );
      const selectedIngredient = ingredients.find((ingredient) => ingredient.id === ingredientId);
      const selectedPackagingItem = packagingItems.find(
        (packagingItem) => packagingItem.id === packagingItemId,
      );

      form.reset({
        branchId: branchScope.normalizeBranchId(activeBranches[0]?.id ?? ""),
        itemType,
        productId,
        unitId:
          preselectedItem?.unitId ??
          selectedProduct?.unitId ??
          selectedIngredient?.unitId ??
          selectedPackagingItem?.unitId ??
          "",
        stockLocationId: defaultStockLocation?.id ?? "",
        quantity: 0,
        reorderLevel: preselectedItem?.reorderLevel ?? 0,
        isExpiryTracked:
          preselectedItem?.isExpiryTracked ??
          selectedProduct?.isExpiryTracked ??
          selectedIngredient?.isExpiryTracked ??
          false,
        expiryDate: "",
        productVariantId: selectedVariant?.id ?? preselectedItem?.productVariantId ?? "",
        ingredientId,
        packagingItemId,
        reason: "",
      });
    }
  }, [
    activeBranches,
    branchScope,
    defaultStockLocation?.id,
    form,
    ingredients,
    open,
    packagingItems,
    preselectedItem,
    products,
  ]);

  const handleProductChange = (productId: string): void => {
    const product = products.find((item) => item.id === productId);
    form.setValue("productId", productId);
    form.setValue("productVariantId", "");
    if (product?.unitId) {
      form.setValue("unitId", product.unitId);
      form.setValue("isExpiryTracked", product.isExpiryTracked);
    }
  };

  const handleIngredientChange = (ingredientId: string): void => {
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    form.setValue("ingredientId", ingredientId);
    if (ingredient?.unitId) {
      form.setValue("unitId", ingredient.unitId);
      form.setValue("isExpiryTracked", ingredient.isExpiryTracked);
    }
  };

  const handlePackagingChange = (packagingItemId: string): void => {
    const packagingItem = packagingItems.find((item) => item.id === packagingItemId);
    form.setValue("packagingItemId", packagingItemId);
    if (packagingItem?.unitId) {
      form.setValue("unitId", packagingItem.unitId);
      form.setValue("isExpiryTracked", false);
    }
  };

  const handleItemTypeChange = (value: OpeningStockSchema["itemType"]): void => {
    form.setValue("itemType", value);
    form.setValue("productId", "");
    form.setValue("productVariantId", "");
    form.setValue("ingredientId", "");
    form.setValue("packagingItemId", "");
    form.setValue("unitId", "");
    form.setValue("isExpiryTracked", false);
  };

  const handleSubmit = async (values: OpeningStockSchema): Promise<void> => {
    await onSubmit({
      branchId: values.branchId,
      itemType: values.itemType,
      ...(values.productId ? { productId: values.productId } : {}),
      ...(values.productVariantId ? { productVariantId: values.productVariantId } : {}),
      ...(values.ingredientId ? { ingredientId: values.ingredientId } : {}),
      ...(values.packagingItemId ? { packagingItemId: values.packagingItemId } : {}),
      unitId: values.unitId,
      ...(values.stockLocationId ? { stockLocationId: values.stockLocationId } : {}),
      quantity: values.quantity,
      reorderLevel: values.reorderLevel,
      isExpiryTracked: values.isExpiryTracked,
      ...(values.expiryDate ? { expiryDate: values.expiryDate } : {}),
      ...(values.reason ? { reason: values.reason } : {}),
    });
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create opening stock</DialogTitle>
          <DialogDescription>
            Start branch-level stock tracking for products, variants, ingredients, and packaging
            items.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void handleSubmit(values);
            })(event);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Branch</Label>
              <SearchableCombobox
                emptyMessage="No matching branches found."
                onValueChange={(value) => form.setValue("branchId", value)}
                options={branchOptions}
                placeholder="Select branch"
                searchPlaceholder="Search branch name or code..."
                value={form.watch("branchId")}
              />
            </div>
            <div className="space-y-1">
              <Label>Item type</Label>
              <Select
                onValueChange={(value) =>
                  handleItemTypeChange(value as OpeningStockSchema["itemType"])
                }
                value={itemType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="product_variant">Variant</SelectItem>
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {itemType === "product" || itemType === "product_variant" ? (
              <div className="space-y-1">
                <Label>Product</Label>
                <SearchableCombobox
                  emptyMessage="No matching products found."
                  onValueChange={handleProductChange}
                  options={productOptions}
                  placeholder="Select product"
                  searchPlaceholder="Search product, SKU, barcode, category..."
                  value={form.watch("productId") ?? ""}
                />
                {form.formState.errors.productId ? (
                  <p className="text-sm text-red-800">{form.formState.errors.productId.message}</p>
                ) : null}
              </div>
            ) : null}
            {itemType === "product_variant" ? (
              <div className="space-y-1">
                <Label>Variant</Label>
                <SearchableCombobox
                  disabled={!selectedProductId}
                  emptyMessage="No matching variants found."
                  onValueChange={(value) => form.setValue("productVariantId", value)}
                  options={variantOptions}
                  placeholder={
                    selectedProductId ? "Select product variant" : "Select product first"
                  }
                  searchPlaceholder="Search variant, SKU, barcode..."
                  value={form.watch("productVariantId") ?? ""}
                />
                {form.formState.errors.productVariantId ? (
                  <p className="text-sm text-red-800">
                    {form.formState.errors.productVariantId.message}
                  </p>
                ) : selectedProductId && activeProductVariants.length === 0 ? (
                  <p className="text-sm text-brand-mocha">This product has no active variants.</p>
                ) : null}
              </div>
            ) : null}
            {itemType === "ingredient" ? (
              <div className="space-y-1">
                <Label>Ingredient</Label>
                <SearchableCombobox
                  emptyMessage="No matching ingredients found."
                  onValueChange={handleIngredientChange}
                  options={ingredientOptions}
                  placeholder="Select ingredient"
                  searchPlaceholder="Search ingredient, category, supplier..."
                  value={form.watch("ingredientId") ?? ""}
                />
                {form.formState.errors.ingredientId ? (
                  <p className="text-sm text-red-800">
                    {form.formState.errors.ingredientId.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            {itemType === "packaging" ? (
              <div className="space-y-1">
                <Label>Packaging</Label>
                <SearchableCombobox
                  emptyMessage="No matching packaging items found."
                  onValueChange={handlePackagingChange}
                  options={packagingOptions}
                  placeholder="Select packaging item"
                  searchPlaceholder="Search packaging, category, supplier..."
                  value={form.watch("packagingItemId") ?? ""}
                />
                {form.formState.errors.packagingItemId ? (
                  <p className="text-sm text-red-800">
                    {form.formState.errors.packagingItemId.message}
                  </p>
                ) : null}
              </div>
            ) : null}
            {stockLocations.length > 0 ? (
              <div className="space-y-1">
                <Label>Stock location</Label>
                <SearchableCombobox
                  emptyMessage="No matching stock locations found."
                  onValueChange={(value) => form.setValue("stockLocationId", value)}
                  options={stockLocationOptions}
                  placeholder="Default stock location"
                  searchPlaceholder="Search location name or code..."
                  value={form.watch("stockLocationId") ?? ""}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>Unit</Label>
              <SearchableCombobox
                emptyMessage="No matching units found."
                onValueChange={(value) => form.setValue("unitId", value)}
                options={unitOptions}
                placeholder="Select unit"
                searchPlaceholder="Search unit..."
                value={form.watch("unitId")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openingQuantity">Opening quantity</Label>
              <Input
                id="openingQuantity"
                step="0.001"
                type="number"
                {...form.register("quantity")}
              />
            </div>
            <div className="space-y-1">
              <ReorderLevelLabel htmlFor="reorderLevel" />
              <Input
                id="reorderLevel"
                step="0.001"
                type="number"
                {...form.register("reorderLevel")}
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm text-brand-espresso">
              <Checkbox
                checked={expiryTracked}
                onCheckedChange={(checked) => form.setValue("isExpiryTracked", checked === true)}
              />
              Expiry tracked
            </label>
            {expiryTracked ? (
              <div className="space-y-1">
                <Label htmlFor="expiryDate">Initial expiry date</Label>
                <Input id="expiryDate" type="date" {...form.register("expiryDate")} />
              </div>
            ) : null}
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="openingReason">Reason</Label>
              <Input id="openingReason" {...form.register("reason")} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create opening stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
