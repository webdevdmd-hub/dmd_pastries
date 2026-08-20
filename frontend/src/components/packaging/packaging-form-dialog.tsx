"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ReorderLevelLabel } from "@/components/shared/reorder-level-help";
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
import {
  type CreatePackagingFormValues,
  createPackagingSchema,
} from "@/lib/validators/packaging.schema";
import type {
  CreatePackagingPayload,
  PackagingCategory,
  PackagingItem,
  PackagingSupplierOption,
  PackagingUnitOption,
  UpdatePackagingPayload,
} from "@/types/packaging";

type PackagingFormDialogProps = {
  categories: PackagingCategory[];
  isSubmitting: boolean;
  item: PackagingItem | null;
  onClose: () => void;
  onCreate: (payload: CreatePackagingPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdatePackagingPayload) => Promise<void>;
  open: boolean;
  suppliers: PackagingSupplierOption[];
  units: PackagingUnitOption[];
};

function defaultValues(item: PackagingItem | null): CreatePackagingFormValues {
  return {
    packagingName: item?.packagingName ?? "",
    packagingCategoryId: item?.packagingCategoryId ?? "",
    supplierId: item?.supplierId ?? null,
    unitId: item?.unitId ?? "",
    costPerUnit: item?.costPerUnit ?? 0,
    isStockTracked: item?.isStockTracked ?? true,
    isConsumable: item?.isConsumable ?? true,
    reorderLevel: item?.reorderLevel ?? 0,
    description: item?.description ?? "",
    imageFileId: item?.imageFileId ?? "",
  };
}

export function PackagingFormDialog({
  categories,
  isSubmitting,
  item,
  onClose,
  onCreate,
  onUpdate,
  open,
  suppliers,
  units,
}: PackagingFormDialogProps): JSX.Element {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const form = useForm<CreatePackagingFormValues>({
    resolver: zodResolver(createPackagingSchema),
    defaultValues: defaultValues(item),
  });

  useEffect(() => {
    form.reset(defaultValues(item));
    setSelectedImage(null);
  }, [form, item]);

  const previewUrl = useMemo(() => {
    if (selectedImage) {
      return URL.createObjectURL(selectedImage);
    }

    return getProductImagePreviewUrl(item?.imageFileId ?? null) ?? item?.imageUrl ?? null;
  }, [item?.imageFileId, item?.imageUrl, selectedImage]);

  useEffect(() => {
    if (!selectedImage || !previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl, selectedImage]);

  const submit = async (values: CreatePackagingFormValues): Promise<void> => {
    let imageFileId = values.imageFileId?.trim() ? values.imageFileId : null;

    if (selectedImage) {
      setIsUploadingImage(true);
      try {
        imageFileId = await uploadProductImage(selectedImage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to upload packaging image.";
        toast.error(message);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const payload: CreatePackagingPayload = {
      packagingName: values.packagingName,
      packagingCategoryId: values.packagingCategoryId,
      supplierId: values.supplierId ?? null,
      unitId: values.unitId,
      costPerUnit: values.costPerUnit,
      isStockTracked: values.isStockTracked,
      isConsumable: values.isConsumable,
      reorderLevel: values.reorderLevel,
      description: values.description ?? null,
      imageUrl: null,
      imageFileId,
    };

    if (item) {
      await onUpdate(item.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreatePackagingFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit packaging" : "Add packaging"}</DialogTitle>
          <DialogDescription>
            Manage packaging catalog details, cost, supplier linkage, and operational behavior.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-6"
          onSubmit={(event) => {
            void form.handleSubmit(submit)(event);
          }}
        >
          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-2">Basic Information</h3>
            <label className="grid gap-2">
              <Label htmlFor="packaging-name">Packaging name</Label>
              <Input id="packaging-name" {...form.register("packagingName")} />
              {fieldError("packagingName") ? (
                <span className="text-sm text-danger-text">{fieldError("packagingName")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="packaging-form-packaging-category">Packaging category</Label>
              <Select
                onValueChange={(value) => form.setValue("packagingCategoryId", value)}
                value={form.watch("packagingCategoryId")}
              >
                <SelectTrigger id="packaging-form-packaging-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("packagingCategoryId") ? (
                <span className="text-sm text-danger-text">
                  {fieldError("packagingCategoryId")}
                </span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="packaging-form-supplier">Supplier</Label>
              <Select
                onValueChange={(value) =>
                  form.setValue("supplierId", value === "none" ? null : value)
                }
                value={form.watch("supplierId") ?? "none"}
              >
                <SelectTrigger id="packaging-form-supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <Label htmlFor="packaging-form-unit">Unit</Label>
              <Select
                onValueChange={(value) => form.setValue("unitId", value)}
                value={form.watch("unitId")}
              >
                <SelectTrigger id="packaging-form-unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unitName} ({unit.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("unitId") ? (
                <span className="text-sm text-danger-text">{fieldError("unitId")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="packaging-cost">Cost per unit</Label>
              <Input
                id="packaging-cost"
                min="0"
                step="0.01"
                type="number"
                {...form.register("costPerUnit")}
              />
              {fieldError("costPerUnit") ? (
                <span className="text-sm text-danger-text">{fieldError("costPerUnit")}</span>
              ) : null}
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-3">Behavior</h3>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte p-3">
              <Checkbox
                checked={form.watch("isStockTracked")}
                onCheckedChange={(checked) => form.setValue("isStockTracked", checked === true)}
              />
              <span className="text-sm font-medium text-brand-espresso">Stock tracked</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte p-3">
              <Checkbox
                checked={form.watch("isConsumable")}
                onCheckedChange={(checked) => form.setValue("isConsumable", checked === true)}
              />
              <span className="text-sm font-medium text-brand-espresso">Consumable</span>
            </label>
            <div className="grid gap-2">
              <ReorderLevelLabel htmlFor="packaging-reorder" />
              <Input
                id="packaging-reorder"
                min="0"
                step="0.01"
                type="number"
                {...form.register("reorderLevel")}
              />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-2">Media & Notes</h3>
            <label className="grid gap-2">
              <Label htmlFor="packaging-image">Packaging image</Label>
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                {previewUrl ? (
                  <img
                    alt="Selected packaging"
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
                  id="packaging-image"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedImage(file);
                  }}
                  type="file"
                />
              </div>
            </label>
            <label className="grid gap-2">
              <Label htmlFor="packaging-description">Description</Label>
              <textarea
                className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
                id="packaging-description"
                {...form.register("description")}
              />
            </label>
          </section>

          <DialogFooter>
            <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting || isUploadingImage} type="submit">
              {isSubmitting || isUploadingImage
                ? "Saving..."
                : item
                  ? "Save changes"
                  : "Create packaging"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
