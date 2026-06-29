"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getProductImagePreviewUrl, uploadProductImage } from "@/lib/appwrite/storage";
import { type ProductSchema, productSchema } from "@/lib/validators/product.schema";
import type { ProductReferenceData } from "@/types/product";
import {
  COST_UPDATE_POLICY_LABELS,
  type CreateProductPayload,
  ITEM_STRUCTURE_LABELS,
  ITEM_STRUCTURES,
  PRICING_TYPE_LABELS,
  type Product,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPES,
  type UpdateProductPayload,
} from "@/types/product";

type ProductFormDialogProps = {
  onClose: () => void;
  onCreate: (payload: CreateProductPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateProductPayload) => Promise<void>;
  open: boolean;
  product: Product | null;
  referenceData: ProductReferenceData;
  submitting: boolean;
};

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="text-xs font-medium text-red-700">{message}</p> : null;
}

function toDefaultValues(product: Product | null): ProductSchema {
  return {
    productName: product?.productName ?? "",
    categoryId: product?.categoryId ?? "",
    unitId: product?.unitId ?? "",
    taxRateId: product?.taxRateId ?? "",
    productType: product?.productType ?? "finished_product",
    itemStructure: product?.itemStructure ?? "single",
    salePrice: product?.salePrice ?? 0,
    costPrice: product?.costPrice ?? null,
    costUpdatePolicy: product?.costUpdatePolicy ?? "manual",
    pricingType: product?.pricingType ?? "markup",
    pricingPercent: product?.pricingPercent ?? 0,
    minimumSalePrice: product?.minimumSalePrice ?? null,
    autoPriceUpdateEnabled: product?.autoPriceUpdateEnabled ?? false,
    salePriceLocked: product?.salePriceLocked ?? false,
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    description: product?.description ?? "",
    imageFileId: product?.imageFileId ?? "",
    isPosVisible: product?.isPosVisible ?? true,
    isStockTracked: product?.isStockTracked ?? true,
    isExpiryTracked: product?.isExpiryTracked ?? false,
    isCustomOrderAvailable: product?.isCustomOrderAvailable ?? false,
    preparationTimeMinutes: product?.preparationTimeMinutes ?? null,
  };
}

export function ProductFormDialog({
  onClose,
  onCreate,
  onUpdate,
  open,
  product,
  referenceData,
  submitting,
}: ProductFormDialogProps): JSX.Element {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const form = useForm<ProductSchema>({
    resolver: zodResolver(productSchema),
    defaultValues: toDefaultValues(product),
  });
  const watchedTaxRateId = form.watch("taxRateId") ?? "";
  const watchedItemStructure = form.watch("itemStructure");
  const watchedProductType = form.watch("productType");
  const watchedCostPrice = form.watch("costPrice");
  const watchedMinimumSalePrice = form.watch("minimumSalePrice") ?? null;
  const watchedPricingPercent = form.watch("pricingPercent");
  const watchedPricingType = form.watch("pricingType");

  const compatibleCategories = useMemo(
    () =>
      referenceData.categories.filter(
        (category) =>
          category.allowedProductTypes.length === 0 ||
          category.allowedProductTypes.includes(watchedProductType),
      ),
    [referenceData.categories, watchedProductType],
  );

  useEffect(() => {
    form.reset(toDefaultValues(product));
    setSelectedImage(null);
  }, [form, product]);

  useEffect(() => {
    const categoryId = form.getValues("categoryId");

    if (categoryId && !compatibleCategories.some((category) => category.id === categoryId)) {
      form.setValue("categoryId", "");
    }
  }, [compatibleCategories, form]);

  const previewUrl = useMemo(() => {
    if (selectedImage) {
      return URL.createObjectURL(selectedImage);
    }

    return getProductImagePreviewUrl(product?.imageFileId ?? null) ?? product?.imageUrl ?? null;
  }, [product?.imageFileId, product?.imageUrl, selectedImage]);

  useEffect(() => {
    if (!selectedImage || !previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl, selectedImage]);

  const liveSuggestedPrice = useMemo(() => {
    const cost = watchedCostPrice ?? 0;
    const percent = watchedPricingPercent;
    let price = cost;
    if (watchedPricingType === "margin") {
      price = percent >= 100 ? 0 : cost / (1 - percent / 100);
    } else {
      price = cost * (1 + percent / 100);
    }
    if (watchedMinimumSalePrice !== null && price < watchedMinimumSalePrice) {
      price = watchedMinimumSalePrice;
    }
    return Math.round(price * 100) / 100;
  }, [watchedCostPrice, watchedMinimumSalePrice, watchedPricingPercent, watchedPricingType]);

  const onSubmit = async (values: ProductSchema): Promise<void> => {
    let imageFileId = values.imageFileId?.trim() ? values.imageFileId : null;

    if (selectedImage) {
      setIsUploadingImage(true);
      try {
        imageFileId = await uploadProductImage(selectedImage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload product image.";
        toast.error(message);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const payload: CreateProductPayload = {
      productName: values.productName,
      categoryId: values.categoryId,
      unitId: values.unitId,
      taxRateId: values.taxRateId?.trim() ? values.taxRateId : null,
      productType: values.productType,
      itemStructure: values.itemStructure,
      salePrice: values.salePrice,
      costPrice: values.costPrice ?? null,
      costUpdatePolicy: values.costUpdatePolicy,
      pricingType: values.pricingType,
      pricingPercent: values.pricingPercent,
      minimumSalePrice: values.minimumSalePrice ?? null,
      autoPriceUpdateEnabled: values.autoPriceUpdateEnabled,
      salePriceLocked: values.salePriceLocked,
      sku: values.sku?.trim() ? values.sku : null,
      barcode: values.barcode?.trim() ? values.barcode : null,
      description: values.description?.trim() ? values.description : null,
      imageUrl: null,
      imageFileId,
      isPosVisible: values.isPosVisible,
      isStockTracked: values.isStockTracked,
      isExpiryTracked: values.isExpiryTracked,
      isCustomOrderAvailable: values.isCustomOrderAvailable,
      preparationTimeMinutes: values.preparationTimeMinutes ?? null,
    };

    if (product) {
      await onUpdate(product.id, payload);
      return;
    }

    await onCreate(payload);
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Set the catalog identity, pricing, POS visibility, and stock behavior for this item.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void onSubmit(values);
            })(event);
          }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-brand-espresso">Catalog identity</h3>
                <p className="text-sm text-brand-mocha">
                  Use clear names and category mapping so billing staff can find products quickly.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="productName">Product name</Label>
                  <Input id="productName" {...form.register("productName")} />
                  <FieldError message={form.formState.errors.productName?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Product type</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("productType", value as ProductSchema["productType"])
                    }
                    value={form.watch("productType")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {PRODUCT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Item structure</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("itemStructure", value as ProductSchema["itemStructure"])
                    }
                    value={form.watch("itemStructure")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_STRUCTURES.map((itemStructure) => (
                        <SelectItem key={itemStructure} value={itemStructure}>
                          {ITEM_STRUCTURE_LABELS[itemStructure]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watchedItemStructure === "recipe_based" ? (
                    <p className="text-xs text-brand-mocha">
                      This product should be linked to a recipe in a later step.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Category</Label>
                  <Select
                    onValueChange={(value) => form.setValue("categoryId", value)}
                    value={form.watch("categoryId")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleCategories.length === 0 ? (
                        <SelectItem disabled value="__no_categories">
                          No compatible categories
                        </SelectItem>
                      ) : null}
                      {compatibleCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-brand-mocha">
                    Categories are filtered by the selected product type.
                  </p>
                  <FieldError message={form.formState.errors.categoryId?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Unit</Label>
                  <Select
                    onValueChange={(value) => form.setValue("unitId", value)}
                    value={form.watch("unitId")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {referenceData.units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unitName} ({unit.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.unitId?.message} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-brand-espresso">Pricing and tax</h3>
                <p className="text-sm text-brand-mocha">
                  Prices are used by POS and receipt generation. Cost price is optional.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="salePrice">Sale price</Label>
                  <Input id="salePrice" type="number" {...form.register("salePrice")} />
                  <FieldError message={form.formState.errors.salePrice?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="costPrice">Cost price</Label>
                  <Input id="costPrice" type="number" {...form.register("costPrice")} />
                  <FieldError message={form.formState.errors.costPrice?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Cost update policy</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("costUpdatePolicy", value as ProductSchema["costUpdatePolicy"])
                    }
                    value={form.watch("costUpdatePolicy")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COST_UPDATE_POLICY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Pricing type</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("pricingType", value as ProductSchema["pricingType"])
                    }
                    value={form.watch("pricingType")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRICING_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="pricingPercent">Pricing percent</Label>
                  <Input id="pricingPercent" type="number" {...form.register("pricingPercent")} />
                  <FieldError message={form.formState.errors.pricingPercent?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="minimumSalePrice">Minimum sale price</Label>
                  <Input
                    id="minimumSalePrice"
                    type="number"
                    {...form.register("minimumSalePrice")}
                  />
                  <FieldError message={form.formState.errors.minimumSalePrice?.message} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Tax rate</Label>
                  <Select
                    onValueChange={(value) =>
                      form.setValue("taxRateId", value === "__none" ? "" : value)
                    }
                    value={watchedTaxRateId.trim() ? watchedTaxRateId : "__none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional tax rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">No tax rate</SelectItem>
                      {referenceData.taxRates.map((taxRate) => (
                        <SelectItem key={taxRate.id} value={taxRate.id}>
                          {taxRate.taxName} ({taxRate.ratePercentage}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 grid gap-3 rounded-2xl border border-brand-cappuccino/70 bg-white/70 p-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
                    Suggested selling price
                  </p>
                  <p className="mt-1 text-lg font-semibold text-brand-espresso">
                    AED {liveSuggestedPrice.toFixed(2)}
                  </p>
                </div>
                <label className="flex items-center gap-2 rounded-xl bg-brand-latte/60 p-2 text-sm text-brand-espresso">
                  <Checkbox
                    checked={form.watch("autoPriceUpdateEnabled")}
                    onCheckedChange={(checked) =>
                      form.setValue("autoPriceUpdateEnabled", checked === true)
                    }
                  />
                  Auto-update POS price
                </label>
                <label className="flex items-center gap-2 rounded-xl bg-brand-latte/60 p-2 text-sm text-brand-espresso">
                  <Checkbox
                    checked={form.watch("salePriceLocked")}
                    onCheckedChange={(checked) =>
                      form.setValue("salePriceLocked", checked === true)
                    }
                  />
                  Lock sale price
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-brand-espresso">Operational behavior</h3>
                <p className="text-sm text-brand-mocha">
                  Control whether this item appears in POS and how inventory should track it.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="preparationTimeMinutes">Preparation time (minutes)</Label>
                  <Input
                    id="preparationTimeMinutes"
                    type="number"
                    {...form.register("preparationTimeMinutes")}
                  />
                  <FieldError message={form.formState.errors.preparationTimeMinutes?.message} />
                </div>
                <div className="grid gap-2 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/40 p-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl bg-white/60 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("isPosVisible")}
                      onCheckedChange={(checked) => form.setValue("isPosVisible", checked === true)}
                    />
                    POS visible
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/60 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("isStockTracked")}
                      onCheckedChange={(checked) =>
                        form.setValue("isStockTracked", checked === true)
                      }
                    />
                    Stock tracked
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/60 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("isExpiryTracked")}
                      onCheckedChange={(checked) =>
                        form.setValue("isExpiryTracked", checked === true)
                      }
                    />
                    Expiry tracked
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/60 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("isCustomOrderAvailable")}
                      onCheckedChange={(checked) =>
                        form.setValue("isCustomOrderAvailable", checked === true)
                      }
                    />
                    Custom order available
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-brand-espresso">Identifiers and media</h3>
                <p className="text-sm text-brand-mocha">
                  SKU, barcode, and image make catalog search and POS selection faster.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" {...form.register("sku")} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input id="barcode" {...form.register("barcode")} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="productImage">Product image</Label>
                  <div className="flex flex-col gap-3 rounded-lg border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                    {previewUrl ? (
                      <img
                        alt="Selected product"
                        className="h-20 w-20 rounded-md object-cover"
                        src={previewUrl}
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-md bg-brand-cappuccino/50 text-xs text-brand-mocha">
                        No image
                      </div>
                    )}
                    <Input
                      accept="image/jpeg,image/png,image/webp"
                      id="productImage"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setSelectedImage(file);
                      }}
                      type="file"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" {...form.register("description")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="sticky bottom-0 -mx-2 rounded-2xl border border-brand-cappuccino/70 bg-white/95 p-3 backdrop-blur">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={submitting || isUploadingImage} type="submit">
              {submitting || isUploadingImage
                ? "Saving..."
                : product
                  ? "Save changes"
                  : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
