"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

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
import type { OpeningStockPayload } from "@/types/inventory";
import type { Unit } from "@/types/master-data";
import type { PackagingItem } from "@/types/packaging";
import type { Product } from "@/types/product";

type OpeningStockDialogProps = {
  branches: Branch[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: OpeningStockPayload) => Promise<void>;
  open: boolean;
  ingredients: Ingredient[];
  packagingItems: PackagingItem[];
  products: Product[];
  units: Unit[];
};

export function OpeningStockDialog({
  branches,
  isSubmitting,
  onClose,
  onSubmit,
  open,
  ingredients,
  packagingItems,
  products,
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
  const form = useForm<OpeningStockSchema>({
    resolver: zodResolver(openingStockSchema),
    defaultValues: {
      branchId: "",
      itemType: "product",
      productId: "",
      unitId: "",
      quantity: 0,
      reorderLevel: 0,
      isExpiryTracked: false,
      expiryDate: "",
      reason: "",
    },
  });
  const itemType = form.watch("itemType");
  const expiryTracked = form.watch("isExpiryTracked");

  useEffect(() => {
    if (open) {
      form.reset({
        branchId: branchScope.normalizeBranchId(activeBranches[0]?.id ?? ""),
        itemType: "product",
        productId: "",
        unitId: "",
        quantity: 0,
        reorderLevel: 0,
        isExpiryTracked: false,
        expiryDate: "",
        ingredientId: "",
        packagingItemId: "",
        reason: "",
      });
    }
  }, [activeBranches, branchScope, form, open]);

  const handleProductChange = (productId: string): void => {
    const product = products.find((item) => item.id === productId);
    form.setValue("productId", productId);
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
      ...(values.ingredientId ? { ingredientId: values.ingredientId } : {}),
      ...(values.packagingItemId ? { packagingItemId: values.packagingItemId } : {}),
      unitId: values.unitId,
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
            Start branch-level stock tracking for products, ingredients, and packaging items.
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
              <Select
                onValueChange={(value) => form.setValue("branchId", value)}
                value={form.watch("branchId")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {activeBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <SelectItem value="ingredient">Ingredient</SelectItem>
                  <SelectItem value="packaging">Packaging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {itemType === "product" ? (
              <div className="space-y-1">
                <Label>Product</Label>
                <Select onValueChange={handleProductChange} value={form.watch("productId") ?? ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.productId ? (
                  <p className="text-sm text-red-800">{form.formState.errors.productId.message}</p>
                ) : null}
              </div>
            ) : null}
            {itemType === "ingredient" ? (
              <div className="space-y-1">
                <Label>Ingredient</Label>
                <Select
                  onValueChange={handleIngredientChange}
                  value={form.watch("ingredientId") ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.map((ingredient) => (
                      <SelectItem key={ingredient.id} value={ingredient.id}>
                        {ingredient.ingredientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select
                  onValueChange={handlePackagingChange}
                  value={form.watch("packagingItemId") ?? ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging item" />
                  </SelectTrigger>
                  <SelectContent>
                    {packagingItems.map((packagingItem) => (
                      <SelectItem key={packagingItem.id} value={packagingItem.id}>
                        {packagingItem.packagingName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.packagingItemId ? (
                  <p className="text-sm text-red-800">
                    {form.formState.errors.packagingItemId.message}
                  </p>
                ) : null}
              </div>
            ) : null}
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
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unitName} ({unit.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="reorderLevel">Reorder level</Label>
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
