"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

type ProductVariantFormDialogProps = {
  onClose: () => void;
  onCreate: (payload: CreateProductVariantPayload) => Promise<void>;
  onUpdate: (variantId: string, payload: UpdateProductVariantPayload) => Promise<void>;
  open: boolean;
  submitting: boolean;
  variant: ProductVariant | null;
};

function toDefaultValues(variant: ProductVariant | null): ProductVariantSchema {
  return {
    variantName: variant?.variantName ?? "",
    sku: variant?.sku ?? "",
    barcode: variant?.barcode ?? "",
    salePrice: variant?.salePrice ?? 0,
    costPrice: variant?.costPrice ?? null,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{variant ? "Edit variant" : "Add variant"}</DialogTitle>
          <DialogDescription>Manage product variant price and identifiers.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              void onSubmit(values);
            })(event);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="variantName">Variant name</Label>
              <Input id="variantName" {...form.register("variantName")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" {...form.register("sortOrder")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="salePrice">Sale price</Label>
              <Input id="salePrice" type="number" {...form.register("salePrice")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="costPrice">Cost price</Label>
              <Input id="costPrice" type="number" {...form.register("costPrice")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...form.register("sku")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="variantImage">Variant image</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                {previewUrl ? (
                  <img
                    alt="Selected variant"
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
                  id="variantImage"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedImage(file);
                  }}
                  type="file"
                />
              </div>
            </div>
            <div className="space-y-1">
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
          </div>
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
