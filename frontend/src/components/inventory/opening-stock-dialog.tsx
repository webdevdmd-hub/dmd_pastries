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
import type { InventoryItem, OpeningStockPayload, StockLocation } from "@/types/inventory";
import type { Unit } from "@/types/master-data";
import { type Product, PRODUCT_TYPE_LABELS } from "@/types/product";

type OpeningStockDialogProps = {
  branches: Branch[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: OpeningStockPayload) => Promise<void>;
  open: boolean;
  preselectedItem?: InventoryItem | null;
  products: Product[];
  stockLocations: StockLocation[];
  units: Unit[];
};

const STOCK_RELEVANT_PRODUCT_TYPES = new Set([
  "finished_product",
  "ingredient",
  "packaging",
  "raw_material",
  "semi_finished",
  "consumable",
  "equipment",
]);

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

export function OpeningStockDialog({
  branches,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  preselectedItem = null,
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
      unitCost: 0,
      reorderLevel: 0,
      isExpiryTracked: false,
      expiryDate: "",
      reason: "",
    },
  });
  const itemType = form.watch("itemType");
  const selectedProductId = form.watch("productId") ?? "";
  const openingQuantity = form.watch("quantity");
  const openingUnitCost = form.watch("unitCost");
  const expiryTracked = form.watch("isExpiryTracked");
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const stockTrackedProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.isStockTracked &&
          product.status === "active" &&
          STOCK_RELEVANT_PRODUCT_TYPES.has(product.productType),
      ),
    [products],
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
      stockTrackedProducts.map((product) => ({
        value: product.id,
        label: product.productName,
        description: [
          PRODUCT_TYPE_LABELS[product.productType],
          product.categoryName,
          product.sku,
          product.barcode,
          product.productCode,
        ]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" / "),
        keywords: [
          product.productName,
          product.productCode,
          product.categoryName,
          PRODUCT_TYPE_LABELS[product.productType],
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
    [stockTrackedProducts],
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
  const estimatedOpeningValue =
    Math.max(openingQuantity || 0, 0) * Math.max(openingUnitCost || 0, 0);

  useEffect(() => {
    if (open) {
      const itemType =
        preselectedItem?.itemType === "product_variant" ? "product_variant" : "product";
      const productId =
        preselectedItem?.itemType === "product" || preselectedItem?.itemType === "product_variant"
          ? (preselectedItem.productId ?? "")
          : "";
      const selectedProduct = products.find((product) => product.id === productId);
      const selectedVariant = selectedProduct?.variants.find(
        (variant) => variant.id === preselectedItem?.productVariantId,
      );
      const defaultUnitCost =
        preselectedItem?.averageCost && preselectedItem.averageCost > 0
          ? preselectedItem.averageCost
          : (selectedVariant?.costPrice ?? selectedProduct?.costPrice ?? 0);

      form.reset({
        branchId: branchScope.normalizeBranchId(activeBranches[0]?.id ?? ""),
        itemType,
        productId,
        unitId: preselectedItem?.unitId ?? selectedProduct?.unitId ?? "",
        stockLocationId: defaultStockLocation?.id ?? "",
        quantity: 0,
        unitCost: defaultUnitCost,
        reorderLevel: preselectedItem?.reorderLevel ?? 0,
        isExpiryTracked:
          preselectedItem?.isExpiryTracked ?? selectedProduct?.isExpiryTracked ?? false,
        expiryDate: "",
        productVariantId: selectedVariant?.id ?? preselectedItem?.productVariantId ?? "",
        reason: "",
      });
    }
  }, [
    activeBranches,
    branchScope,
    defaultStockLocation?.id,
    form,
    open,
    preselectedItem,
    products,
  ]);

  const handleProductChange = (productId: string): void => {
    const product = products.find((item) => item.id === productId);
    form.setValue("productId", productId);
    form.setValue("productVariantId", "");
    form.setValue("unitCost", product?.costPrice ?? 0);
    if (product?.unitId) {
      form.setValue("unitId", product.unitId);
      form.setValue("isExpiryTracked", product.isExpiryTracked);
    }
  };

  const handleItemTypeChange = (value: OpeningStockSchema["itemType"]): void => {
    form.setValue("itemType", value);
    form.setValue("productId", "");
    form.setValue("productVariantId", "");
    form.setValue("unitId", "");
    form.setValue("unitCost", 0);
    form.setValue("isExpiryTracked", false);
  };

  const handleVariantChange = (variantId: string): void => {
    const variant = activeProductVariants.find((item) => item.id === variantId);
    form.setValue("productVariantId", variantId);
    form.setValue("unitCost", variant?.costPrice ?? selectedProduct?.costPrice ?? 0);
  };

  const handleSubmit = async (values: OpeningStockSchema): Promise<void> => {
    await onSubmit({
      branchId: values.branchId,
      itemType: values.itemType,
      ...(values.productId ? { productId: values.productId } : {}),
      ...(values.productVariantId ? { productVariantId: values.productVariantId } : {}),
      unitId: values.unitId,
      ...(values.stockLocationId ? { stockLocationId: values.stockLocationId } : {}),
      quantity: values.quantity,
      unitCost: values.unitCost,
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
            Start branch-level stock tracking for Product Master products and variants.
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
                </SelectContent>
              </Select>
            </div>
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
                <p className="text-sm text-danger-text">
                  {form.formState.errors.productId.message}
                </p>
              ) : null}
            </div>
            {itemType === "product_variant" ? (
              <div className="space-y-1">
                <Label>Variant</Label>
                <SearchableCombobox
                  disabled={!selectedProductId}
                  emptyMessage="No matching variants found."
                  onValueChange={handleVariantChange}
                  options={variantOptions}
                  placeholder={
                    selectedProductId ? "Select product variant" : "Select product first"
                  }
                  searchPlaceholder="Search variant, SKU, barcode..."
                  value={form.watch("productVariantId") ?? ""}
                />
                {form.formState.errors.productVariantId ? (
                  <p className="text-sm text-danger-text">
                    {form.formState.errors.productVariantId.message}
                  </p>
                ) : selectedProductId && activeProductVariants.length === 0 ? (
                  <p className="text-sm text-foreground-muted">
                    This product has no active variants.
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
              {form.formState.errors.quantity ? (
                <p className="text-sm text-danger-text">{form.formState.errors.quantity.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="openingUnitCost">Opening cost</Label>
              <Input
                id="openingUnitCost"
                min="0"
                step="0.01"
                type="number"
                {...form.register("unitCost")}
              />
              {form.formState.errors.unitCost ? (
                <p className="text-sm text-danger-text">{form.formState.errors.unitCost.message}</p>
              ) : (
                <p className="text-xs text-foreground-muted">
                  Estimated opening value: {formatMoney(estimatedOpeningValue)}
                </p>
              )}
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
            <label className="flex items-center gap-2 pt-6 text-sm text-foreground">
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
