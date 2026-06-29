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
import { type ProductVariantSchema, productVariantSchema } from "@/lib/validators/product.schema";
import type {
  CreateProductVariantPayload,
  ProductVariant,
  UpdateProductVariantPayload,
} from "@/types/product";
import { COST_UPDATE_POLICY_LABELS, PRICING_TYPE_LABELS } from "@/types/product";

type ProductVariantFormDialogProps = {
  onClose: () => void;
  onCreate: (payload: CreateProductVariantPayload) => Promise<void>;
  onUpdate: (variantId: string, payload: UpdateProductVariantPayload) => Promise<void>;
  open: boolean;
  submitting: boolean;
  variant: ProductVariant | null;
};

function FieldError({ message }: { message: string | undefined }): JSX.Element | null {
  return message ? <p className="text-xs font-medium text-red-700">{message}</p> : null;
}

function toDefaultValues(variant: ProductVariant | null): ProductVariantSchema {
  return {
    variantName: variant?.variantName ?? "",
    sku: variant?.sku ?? "",
    barcode: variant?.barcode ?? "",
    salePrice: variant?.salePrice ?? 0,
    costPrice: variant?.costPrice ?? null,
    costUpdatePolicy: variant?.costUpdatePolicy ?? "manual",
    pricingType: variant?.pricingType ?? "markup",
    pricingPercent: variant?.pricingPercent ?? 0,
    minimumSalePrice: variant?.minimumSalePrice ?? null,
    autoPriceUpdateEnabled: variant?.autoPriceUpdateEnabled ?? false,
    salePriceLocked: variant?.salePriceLocked ?? false,
    imageFileId: variant?.imageFileId ?? "",
    sortOrder: variant?.sortOrder ?? 0,
    status: variant?.status ?? "active",
  };
}

export function ProductVariantFormDialog({
  onClose,
  onCreate,
  onUpdate,
  open,
  submitting,
  variant,
}: ProductVariantFormDialogProps): JSX.Element {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const form = useForm<ProductVariantSchema>({
    resolver: zodResolver(productVariantSchema),
    defaultValues: toDefaultValues(variant),
  });
  const watchedCostPrice = form.watch("costPrice");
  const watchedMinimumSalePrice = form.watch("minimumSalePrice") ?? null;
  const watchedPricingPercent = form.watch("pricingPercent");
  const watchedPricingType = form.watch("pricingType");

  useEffect(() => {
    form.reset(toDefaultValues(variant));
    setSelectedImage(null);
  }, [form, variant]);

  const previewUrl = useMemo(() => {
    if (selectedImage) {
      return URL.createObjectURL(selectedImage);
    }

    return getProductImagePreviewUrl(variant?.imageFileId ?? null) ?? variant?.imageUrl ?? null;
  }, [selectedImage, variant?.imageFileId, variant?.imageUrl]);

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

  const onSubmit = async (values: ProductVariantSchema): Promise<void> => {
    let imageFileId = values.imageFileId?.trim() ? values.imageFileId : null;

    if (selectedImage) {
      setIsUploadingImage(true);
      try {
        imageFileId = await uploadProductImage(selectedImage);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload variant image.";
        toast.error(message);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const payload: CreateProductVariantPayload = {
      variantName: values.variantName,
      sku: values.sku?.trim() ? values.sku : null,
      barcode: values.barcode?.trim() ? values.barcode : null,
      salePrice: values.salePrice,
      costPrice: values.costPrice ?? null,
      costUpdatePolicy: values.costUpdatePolicy,
      pricingType: values.pricingType,
      pricingPercent: values.pricingPercent,
      minimumSalePrice: values.minimumSalePrice ?? null,
      autoPriceUpdateEnabled: values.autoPriceUpdateEnabled,
      salePriceLocked: values.salePriceLocked,
      imageUrl: null,
      imageFileId,
      sortOrder: values.sortOrder,
      status: values.status,
    };

    if (variant) {
      await onUpdate(variant.id, payload);
      return;
    }

    await onCreate(payload);
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{variant ? "Edit variant" : "Add variant"}</DialogTitle>
          <DialogDescription>
            Variants are sellable options under the same product, such as Small, Large, 500g, or
            1kg.
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
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="variantName">Variant name</Label>
                <Input id="variantName" {...form.register("variantName")} />
                <FieldError message={form.formState.errors.variantName?.message} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
                <FieldError message={form.formState.errors.sortOrder?.message} />
              </div>
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
                    form.setValue(
                      "costUpdatePolicy",
                      value as ProductVariantSchema["costUpdatePolicy"],
                    )
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
                    form.setValue("pricingType", value as ProductVariantSchema["pricingType"])
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
                <Input id="minimumSalePrice" type="number" {...form.register("minimumSalePrice")} />
                <FieldError message={form.formState.errors.minimumSalePrice?.message} />
              </div>
              <div className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/50 p-3 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-mocha">
                  Suggested selling price
                </p>
                <p className="mt-1 text-lg font-semibold text-brand-espresso">
                  AED {liveSuggestedPrice.toFixed(2)}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl bg-white/70 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("autoPriceUpdateEnabled")}
                      onCheckedChange={(checked) =>
                        form.setValue("autoPriceUpdateEnabled", checked === true)
                      }
                    />
                    Auto-update POS price
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-white/70 p-2 text-sm text-brand-espresso">
                    <Checkbox
                      checked={form.watch("salePriceLocked")}
                      onCheckedChange={(checked) =>
                        form.setValue("salePriceLocked", checked === true)
                      }
                    />
                    Lock sale price
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...form.register("sku")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" {...form.register("barcode")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select
                  onValueChange={(value) => form.setValue("status", value as "active" | "inactive")}
                  value={form.watch("status")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Label htmlFor="variantImage">Variant image</Label>
              <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                {previewUrl ? (
                  <img
                    alt="Selected variant"
                    className="h-20 w-20 rounded-xl object-cover"
                    src={previewUrl}
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-cappuccino/50 text-xs text-brand-mocha">
                    No image
                  </div>
                )}
                <Input
                  accept="image/jpeg,image/png,image/webp"
                  id="variantImage"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedImage(file);
                  }}
                  type="file"
                />
              </div>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={submitting || isUploadingImage} type="submit">
              {submitting || isUploadingImage
                ? "Saving..."
                : variant
                  ? "Save changes"
                  : "Create variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
