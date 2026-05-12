"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { getProductImagePreviewUrl, uploadProductImage } from "@/lib/appwrite/storage";
import { type ProductSchema, productSchema } from "@/lib/validators/product.schema";
import type { CreateProductPayload, Product, UpdateProductPayload } from "@/types/product";
import type { ProductReferenceData } from "@/types/product";

type ProductFormDialogProps = {
  onClose: () => void;
  onCreate: (payload: CreateProductPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateProductPayload) => Promise<void>;
  open: boolean;
  product: Product | null;
  referenceData: ProductReferenceData;
  submitting: boolean;
};

function toDefaultValues(product: Product | null): ProductSchema {
  return {
    productName: product?.productName ?? "",
    categoryId: product?.categoryId ?? "",
    unitId: product?.unitId ?? "",
    taxRateId: product?.taxRateId ?? "",
    productType: product?.productType ?? "ready_to_sell",
    salePrice: product?.salePrice ?? 0,
    costPrice: product?.costPrice ?? null,
    compareAtPrice: product?.compareAtPrice ?? null,
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

  useEffect(() => {
    form.reset(toDefaultValues(product));
    setSelectedImage(null);
  }, [form, product]);

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
      salePrice: values.salePrice,
      costPrice: values.costPrice ?? null,
      compareAtPrice: values.compareAtPrice ?? null,
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
            Manage sellable items, bakery products, retail items, variants, pricing, tax, and POS
            visibility.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void onSubmit(values);
            })(event);
          }}
        >
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-mocha">Basic Information</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="productName">Product name</Label>
                <Input id="productName" {...form.register("productName")} />
              </div>
              <div className="space-y-1">
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
                    <SelectItem value="ready_to_sell">Ready to Sell</SelectItem>
                    <SelectItem value="made_to_order">Made to Order</SelectItem>
                    <SelectItem value="manufactured">Manufactured</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  onValueChange={(value) => form.setValue("categoryId", value)}
                  value={form.watch("categoryId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData.categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
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
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-mocha">Pricing & Tax</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="salePrice">Sale price</Label>
                <Input id="salePrice" type="number" {...form.register("salePrice")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="costPrice">Cost price</Label>
                <Input id="costPrice" type="number" {...form.register("costPrice")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="compareAtPrice">Compare at price</Label>
                <Input id="compareAtPrice" type="number" {...form.register("compareAtPrice")} />
              </div>
              <div className="space-y-1">
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
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-mocha">POS & Inventory Behavior</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="preparationTimeMinutes">Preparation time (minutes)</Label>
                <Input
                  id="preparationTimeMinutes"
                  type="number"
                  {...form.register("preparationTimeMinutes")}
                />
              </div>
              <div className="grid gap-2 pt-6">
                <label className="flex items-center gap-2 text-sm text-brand-espresso">
                  <Checkbox
                    checked={form.watch("isPosVisible")}
                    onCheckedChange={(checked) => form.setValue("isPosVisible", checked === true)}
                  />
                  POS visible
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-espresso">
                  <Checkbox
                    checked={form.watch("isStockTracked")}
                    onCheckedChange={(checked) => form.setValue("isStockTracked", checked === true)}
                  />
                  Stock tracked
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-espresso">
                  <Checkbox
                    checked={form.watch("isExpiryTracked")}
                    onCheckedChange={(checked) =>
                      form.setValue("isExpiryTracked", checked === true)
                    }
                  />
                  Expiry tracked
                </label>
                <label className="flex items-center gap-2 text-sm text-brand-espresso">
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
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-brand-mocha">Media & Notes</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...form.register("sku")} />
              </div>
              <div className="space-y-1">
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
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" {...form.register("description")} />
              </div>
            </div>
          </div>

          <DialogFooter>
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
