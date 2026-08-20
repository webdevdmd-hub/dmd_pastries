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
  type CreateIngredientFormValues,
  createIngredientSchema,
} from "@/lib/validators/ingredient.schema";
import type {
  CreateIngredientPayload,
  Ingredient,
  IngredientCategory,
  IngredientSupplierOption,
  IngredientUnitOption,
  UpdateIngredientPayload,
} from "@/types/ingredient";

type IngredientFormDialogProps = {
  categories: IngredientCategory[];
  isSubmitting: boolean;
  item: Ingredient | null;
  onClose: () => void;
  onCreate: (payload: CreateIngredientPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateIngredientPayload) => Promise<void>;
  open: boolean;
  suppliers: IngredientSupplierOption[];
  units: IngredientUnitOption[];
};

function defaultValues(item: Ingredient | null): CreateIngredientFormValues {
  return {
    costPerUnit: item?.costPerUnit ?? 0,
    description: item?.description ?? "",
    imageFileId: item?.imageFileId ?? "",
    ingredientCategoryId: item?.ingredientCategoryId ?? "",
    ingredientName: item?.ingredientName ?? "",
    isExpiryTracked: item?.isExpiryTracked ?? false,
    isStockTracked: item?.isStockTracked ?? true,
    reorderLevel: item?.reorderLevel ?? 0,
    supplierId: item?.supplierId ?? null,
    unitId: item?.unitId ?? "",
  };
}

export function IngredientFormDialog({
  categories,
  isSubmitting,
  item,
  onClose,
  onCreate,
  onUpdate,
  open,
  suppliers,
  units,
}: IngredientFormDialogProps): JSX.Element {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const form = useForm<CreateIngredientFormValues>({
    resolver: zodResolver(createIngredientSchema),
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

  const submit = async (values: CreateIngredientFormValues): Promise<void> => {
    let imageFileId = values.imageFileId?.trim() ? values.imageFileId : null;

    if (selectedImage) {
      setIsUploadingImage(true);
      try {
        imageFileId = await uploadProductImage(selectedImage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to upload ingredient image.";
        toast.error(message);
        return;
      } finally {
        setIsUploadingImage(false);
      }
    }

    const payload: CreateIngredientPayload = {
      costPerUnit: values.costPerUnit,
      description: values.description ?? null,
      imageUrl: null,
      imageFileId,
      ingredientCategoryId: values.ingredientCategoryId,
      ingredientName: values.ingredientName,
      isExpiryTracked: values.isExpiryTracked,
      isStockTracked: values.isStockTracked,
      reorderLevel: values.reorderLevel,
      supplierId: values.supplierId ?? null,
      unitId: values.unitId,
    };

    if (item) {
      await onUpdate(item.id, payload);
      return;
    }

    await onCreate(payload);
  };

  const fieldError = (name: keyof CreateIngredientFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit ingredient" : "Add ingredient"}</DialogTitle>
          <DialogDescription>
            Manage raw material details, category, cost, supplier linkage, and inventory behavior.
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
              <Label htmlFor="ingredient-name">Ingredient name</Label>
              <Input id="ingredient-name" {...form.register("ingredientName")} />
              {fieldError("ingredientName") ? (
                <span className="text-sm text-danger-text">{fieldError("ingredientName")}</span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="ingredient-form-ingredient-category">Ingredient category</Label>
              <Select
                onValueChange={(value) => form.setValue("ingredientCategoryId", value)}
                value={form.watch("ingredientCategoryId")}
              >
                <SelectTrigger id="ingredient-form-ingredient-category">
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
              {fieldError("ingredientCategoryId") ? (
                <span className="text-sm text-danger-text">
                  {fieldError("ingredientCategoryId")}
                </span>
              ) : null}
            </label>
            <label className="grid gap-2">
              <Label htmlFor="ingredient-form-supplier">Supplier</Label>
              <Select
                onValueChange={(value) =>
                  form.setValue("supplierId", value === "none" ? null : value)
                }
                value={form.watch("supplierId") ?? "none"}
              >
                <SelectTrigger id="ingredient-form-supplier">
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
              <Label htmlFor="ingredient-form-unit">Unit</Label>
              <Select
                onValueChange={(value) => form.setValue("unitId", value)}
                value={form.watch("unitId")}
              >
                <SelectTrigger id="ingredient-form-unit">
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
              <Label htmlFor="ingredient-cost">Cost per unit</Label>
              <Input
                id="ingredient-cost"
                min="0"
                step="0.01"
                type="number"
                {...form.register("costPerUnit")}
              />
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <h3 className="text-sm font-bold text-brand-mocha md:col-span-3">Inventory Behavior</h3>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte p-3">
              <Checkbox
                checked={form.watch("isStockTracked")}
                onCheckedChange={(checked) => form.setValue("isStockTracked", checked === true)}
              />
              <span className="text-sm font-medium text-brand-espresso">Stock tracked</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte p-3">
              <Checkbox
                checked={form.watch("isExpiryTracked")}
                onCheckedChange={(checked) => form.setValue("isExpiryTracked", checked === true)}
              />
              <span className="text-sm font-medium text-brand-espresso">Expiry tracked</span>
            </label>
            <div className="grid gap-2">
              <ReorderLevelLabel htmlFor="ingredient-reorder" />
              <Input
                id="ingredient-reorder"
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
              <Label htmlFor="ingredient-image">Ingredient image</Label>
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                {previewUrl ? (
                  <img
                    alt="Selected ingredient"
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
                  id="ingredient-image"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedImage(file);
                  }}
                  type="file"
                />
              </div>
            </label>
            <label className="grid gap-2">
              <Label htmlFor="ingredient-description">Description</Label>
              <textarea
                className="min-h-24 rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
                id="ingredient-description"
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
                  : "Create ingredient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
