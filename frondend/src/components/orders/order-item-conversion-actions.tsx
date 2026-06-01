"use client";

import { Loader2, PackagePlus, Shapes } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useConvertOrderItemToProduct, useConvertOrderItemToVariant } from "@/hooks/use-orders";
import { useProductReferenceData, useProducts } from "@/hooks/use-products";
import { getErrorMessage } from "@/lib/api/client";
import type {
  BakeryOrderItem,
  ConvertOrderItemToProductPayload,
  ConvertOrderItemToVariantPayload,
} from "@/types/orders";
import type { Product } from "@/types/product";

type ConversionMode = "product" | "variant";

type ProductConversionForm = {
  barcode: string;
  categoryId: string;
  description: string;
  isCustomOrderAvailable: boolean;
  isExpiryTracked: boolean;
  isStockTracked: boolean;
  productCode: string;
  productName: string;
  salePrice: string;
  showInPos: boolean;
  sku: string;
  unitId: string;
};

type VariantConversionForm = {
  barcode: string;
  productId: string;
  salePrice: string;
  showInPos: boolean;
  sku: string;
  variantName: string;
};

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function numberOrZero(value: string): number {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function defaultProductForm(item: BakeryOrderItem): ProductConversionForm {
  return {
    barcode: "",
    categoryId: "",
    description: item.designNotes ?? "",
    isCustomOrderAvailable: true,
    isExpiryTracked: false,
    isStockTracked: true,
    productCode: "",
    productName: item.itemNameSnapshot,
    salePrice: String(item.unitPrice),
    showInPos: true,
    sku: "",
    unitId: item.unitId,
  };
}

function defaultVariantForm(item: BakeryOrderItem): VariantConversionForm {
  return {
    barcode: "",
    productId: "",
    salePrice: String(item.unitPrice),
    showInPos: true,
    sku: "",
    variantName: item.itemNameSnapshot,
  };
}

function productOptionDescription(product: Product): string {
  return [product.productCode, product.categoryName, product.unitName]
    .filter((part) => part.length > 0)
    .join(" - ");
}

function ToggleField({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex gap-3 rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/40 p-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
      />
      <span className="grid gap-1 text-sm">
        <span className="font-semibold text-brand-espresso">{label}</span>
        <span className="text-xs leading-5 text-brand-mocha">{description}</span>
      </span>
    </label>
  );
}

export function OrderItemConversionActions({
  canConvertToProduct,
  canConvertToVariant,
  item,
  orderId,
}: {
  canConvertToProduct: boolean;
  canConvertToVariant: boolean;
  item: BakeryOrderItem;
  orderId: string;
}): JSX.Element | null {
  const [mode, setMode] = useState<ConversionMode | null>(null);
  const [productForm, setProductForm] = useState<ProductConversionForm>(() =>
    defaultProductForm(item),
  );
  const [variantForm, setVariantForm] = useState<VariantConversionForm>(() =>
    defaultVariantForm(item),
  );
  const canConvert = item.itemSource === "custom" && (canConvertToProduct || canConvertToVariant);
  const referenceQuery = useProductReferenceData(canConvert);
  const productsQuery = useProducts(
    {
      categoryId: "all",
      isPosVisible: "all",
      limit: 250,
      page: 1,
      productType: "all",
      search: "",
      sortBy: "product_name",
      sortOrder: "asc",
      status: "active",
    },
    canConvert,
  );
  const convertToProductMutation = useConvertOrderItemToProduct();
  const convertToVariantMutation = useConvertOrderItemToVariant();
  const categories = useMemo(
    () => referenceQuery.data?.categories ?? [],
    [referenceQuery.data?.categories],
  );
  const units = useMemo(() => referenceQuery.data?.units ?? [], [referenceQuery.data?.units]);
  const products = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data?.items]);
  const selectedProduct = products.find((product) => product.id === variantForm.productId) ?? null;
  const selectedProductUnitName = selectedProduct?.unitName ?? "Select a product first";
  const isProductSaving = convertToProductMutation.isPending;
  const isVariantSaving = convertToVariantMutation.isPending;
  const categoryOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.categoryName,
        keywords: [category.categoryName],
      })),
    [categories],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: `${unit.unitName} (${unit.symbol})`,
        description: unit.unitCategory.name,
        keywords: [unit.unitName, unit.symbol, unit.unitCategory.name],
      })),
    [units],
  );
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      products.map((product) => ({
        value: product.id,
        label: product.productName,
        description: productOptionDescription(product),
        keywords: [
          product.productName,
          product.productCode,
          product.categoryName,
          product.sku ?? "",
          product.barcode ?? "",
        ],
      })),
    [products],
  );

  if (!canConvert) {
    return null;
  }

  const openProductDialog = (): void => {
    setProductForm(defaultProductForm(item));
    setMode("product");
  };

  const openVariantDialog = (): void => {
    setVariantForm(defaultVariantForm(item));
    setMode("variant");
  };

  const closeDialog = (): void => {
    if (!isProductSaving && !isVariantSaving) {
      setMode(null);
    }
  };

  const submitProductConversion = async (): Promise<void> => {
    const payload: ConvertOrderItemToProductPayload = {
      barcode: nullableText(productForm.barcode),
      categoryId: productForm.categoryId,
      description: nullableText(productForm.description),
      isCustomOrderAvailable: productForm.isCustomOrderAvailable,
      isExpiryTracked: productForm.isExpiryTracked,
      isStockTracked: productForm.isStockTracked,
      productCode: nullableText(productForm.productCode),
      productName: productForm.productName.trim(),
      productType: "made_to_order",
      salePrice: numberOrZero(productForm.salePrice),
      showInPos: productForm.showInPos,
      sku: nullableText(productForm.sku),
      status: "active",
      unitId: productForm.unitId,
    };

    try {
      await convertToProductMutation.mutateAsync({ itemId: item.id, orderId, payload });
      toast.success("Custom item converted to product.");
      setMode(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const submitVariantConversion = async (): Promise<void> => {
    const unitId = selectedProduct?.unitId ?? "";
    const payload: ConvertOrderItemToVariantPayload = {
      barcode: nullableText(variantForm.barcode),
      productId: variantForm.productId,
      salePrice: numberOrZero(variantForm.salePrice),
      showInPos: variantForm.showInPos,
      sku: nullableText(variantForm.sku),
      unitId,
      variantName: variantForm.variantName.trim(),
    };

    try {
      await convertToVariantMutation.mutateAsync({ itemId: item.id, orderId, payload });
      toast.success("Custom item converted to product variant.");
      setMode(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  const productFormIsValid =
    productForm.productName.trim().length > 0 &&
    productForm.categoryId.length > 0 &&
    productForm.unitId.length > 0 &&
    numberOrZero(productForm.salePrice) >= 0;
  const variantFormIsValid =
    variantForm.productId.length > 0 &&
    variantForm.variantName.trim().length > 0 &&
    selectedProduct !== null &&
    numberOrZero(variantForm.salePrice) >= 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canConvertToProduct ? (
          <Button onClick={openProductDialog} size="sm" type="button" variant="outline">
            <PackagePlus className="h-4 w-4" />
            Convert to product
          </Button>
        ) : null}
        {canConvertToVariant ? (
          <Button onClick={openVariantDialog} size="sm" type="button" variant="outline">
            <Shapes className="h-4 w-4" />
            Convert to variant
          </Button>
        ) : null}
      </div>

      <Dialog onOpenChange={(open) => (open ? undefined : closeDialog())} open={mode === "product"}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert custom item to product</DialogTitle>
            <DialogDescription>
              Create a reusable catalog product from this custom bakery order item. This does not
              create stock or change the order total.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Product name</span>
              <Input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, productName: event.target.value }))
                }
                value={productForm.productName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Sale price</span>
              <Input
                min={0}
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, salePrice: event.target.value }))
                }
                step="0.01"
                type="number"
                value={productForm.salePrice}
              />
            </label>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Category</span>
              <SearchableCombobox
                emptyMessage="No product categories found."
                isLoading={referenceQuery.isLoading}
                onRetry={() => void referenceQuery.refetch()}
                onValueChange={(categoryId) =>
                  setProductForm((current) => ({ ...current, categoryId }))
                }
                options={categoryOptions}
                placeholder="Select category"
                searchPlaceholder="Search category..."
                value={productForm.categoryId}
                errorMessage={referenceQuery.isError ? getErrorMessage(referenceQuery.error) : null}
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Unit</span>
              <SearchableCombobox
                emptyMessage="No units found."
                isLoading={referenceQuery.isLoading}
                onRetry={() => void referenceQuery.refetch()}
                onValueChange={(unitId) => setProductForm((current) => ({ ...current, unitId }))}
                options={unitOptions}
                placeholder="Select unit"
                searchPlaceholder="Search unit..."
                value={productForm.unitId}
                errorMessage={referenceQuery.isError ? getErrorMessage(referenceQuery.error) : null}
              />
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Product code</span>
              <Input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, productCode: event.target.value }))
                }
                placeholder="Optional"
                value={productForm.productCode}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">SKU</span>
              <Input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, sku: event.target.value }))
                }
                placeholder="Optional"
                value={productForm.sku}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Barcode</span>
              <Input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, barcode: event.target.value }))
                }
                placeholder="Optional"
                value={productForm.barcode}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Product type</span>
              <Input disabled value="Made to order" />
            </label>
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-sm font-medium text-brand-espresso">Description</span>
              <Input
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Optional product description"
                value={productForm.description}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleField
              checked={productForm.isStockTracked}
              description="Track inventory for this product after opening stock is added."
              label="Stock tracked"
              onCheckedChange={(isStockTracked) =>
                setProductForm((current) => ({ ...current, isStockTracked }))
              }
            />
            <ToggleField
              checked={productForm.showInPos}
              description="Make this product visible for future POS billing."
              label="Show in POS"
              onCheckedChange={(showInPos) =>
                setProductForm((current) => ({ ...current, showInPos }))
              }
            />
            <ToggleField
              checked={productForm.isCustomOrderAvailable}
              description="Allow this product to be selected again in bakery orders."
              label="Available for custom orders"
              onCheckedChange={(isCustomOrderAvailable) =>
                setProductForm((current) => ({ ...current, isCustomOrderAvailable }))
              }
            />
            <ToggleField
              checked={productForm.isExpiryTracked}
              description="Enable this only if finished stock needs expiry batch tracking."
              label="Expiry tracked"
              onCheckedChange={(isExpiryTracked) =>
                setProductForm((current) => ({ ...current, isExpiryTracked }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isProductSaving}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!productFormIsValid || isProductSaving}
              onClick={() => void submitProductConversion()}
              type="button"
            >
              {isProductSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Convert to product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => (open ? undefined : closeDialog())} open={mode === "variant"}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert custom item to variant</DialogTitle>
            <DialogDescription>
              Attach this custom item as a reusable variant under an existing product. The variant
              uses the parent product unit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5 md:col-span-2">
              <span className="text-sm font-medium text-brand-espresso">Parent product</span>
              <SearchableCombobox
                emptyMessage="No matching active products found."
                errorMessage={productsQuery.isError ? getErrorMessage(productsQuery.error) : null}
                isLoading={productsQuery.isLoading}
                onRetry={() => void productsQuery.refetch()}
                onValueChange={(productId) =>
                  setVariantForm((current) => ({ ...current, productId }))
                }
                options={productOptions}
                placeholder="Select parent product"
                searchPlaceholder="Search product, SKU, barcode, category..."
                value={variantForm.productId}
              />
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Variant name</span>
              <Input
                onChange={(event) =>
                  setVariantForm((current) => ({ ...current, variantName: event.target.value }))
                }
                value={variantForm.variantName}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Sale price</span>
              <Input
                min={0}
                onChange={(event) =>
                  setVariantForm((current) => ({ ...current, salePrice: event.target.value }))
                }
                step="0.01"
                type="number"
                value={variantForm.salePrice}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">SKU</span>
              <Input
                onChange={(event) =>
                  setVariantForm((current) => ({ ...current, sku: event.target.value }))
                }
                placeholder="Optional"
                value={variantForm.sku}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Barcode</span>
              <Input
                onChange={(event) =>
                  setVariantForm((current) => ({ ...current, barcode: event.target.value }))
                }
                placeholder="Optional"
                value={variantForm.barcode}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-brand-espresso">Variant unit</span>
              <Input disabled value={selectedProductUnitName} />
            </label>
            <ToggleField
              checked={variantForm.showInPos}
              description="Make this variant visible for future POS billing."
              label="Show in POS"
              onCheckedChange={(showInPos) =>
                setVariantForm((current) => ({ ...current, showInPos }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              disabled={isVariantSaving}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!variantFormIsValid || isVariantSaving}
              onClick={() => void submitVariantConversion()}
              type="button"
            >
              {isVariantSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Convert to variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
