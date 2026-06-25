"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { AccessDeniedCard } from "@/components/recipes/access-denied-card";
import { RecipeCostCard, type RecipeLiveCostPreview } from "@/components/recipes/recipe-cost-card";
import { RecipeHeader } from "@/components/recipes/recipe-header";
import { RecipeIngredientsSection } from "@/components/recipes/recipe-ingredients-section";
import { RecipeInstructionsCard } from "@/components/recipes/recipe-instructions-card";
import { RecipePackagingSection } from "@/components/recipes/recipe-packaging-section";
import { RecipeVersionDialog } from "@/components/recipes/recipe-version-dialog";
import { RecipeYieldCard } from "@/components/recipes/recipe-yield-card";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { useCreateProduct, useProductReferenceData } from "@/hooks/use-products";
import {
  useCreateRecipe,
  useRecipe,
  useRecipeReferenceData,
  useUpdateRecipe,
  useUpdateRecipeStatus,
} from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import {
  type CreateRecipeFormValues,
  type CreateRecipeInputValues,
  createRecipeSchema,
} from "@/lib/validators/recipes.schema";
import {
  type CreateProductPayload,
  ITEM_STRUCTURE_LABELS,
  PRODUCT_TYPE_LABELS,
} from "@/types/product";
import type {
  CreateRecipePayload,
  RecipeIngredientPayload,
  RecipePackagingPayload,
  RecipeProductOption,
  UpdateRecipePayload,
} from "@/types/recipes";

type RecipeFormPageProps = {
  onClose?: () => void;
  onSaved?: () => void;
  presentation?: "dialog" | "page";
  recipeId: string | null;
};

const emptyValues: CreateRecipeInputValues = {
  batchYieldQuantity: 1,
  batchYieldUnitId: "",
  description: null,
  ingredients: [],
  instructions: null,
  newProductVariantName: "",
  newProductVariantSalePrice: null,
  newProductVariantSku: null,
  outputVariantMode: "parent",
  packaging: [],
  preparationTimeMinutes: 0,
  productId: "",
  productVariantId: "",
  recipeName: "",
};

function toCreateRecipePayload(
  values: CreateRecipeFormValues,
  ingredients: RecipeIngredientPayload[],
  packaging: RecipePackagingPayload[],
): CreateRecipePayload {
  return {
    batchYieldQuantity: values.batchYieldQuantity,
    batchYieldUnitId: values.batchYieldUnitId,
    description: values.description,
    ingredients,
    instructions: values.instructions,
    newProductVariant:
      values.outputVariantMode === "new"
        ? {
            salePrice: values.newProductVariantSalePrice ?? 0,
            sku: values.newProductVariantSku,
            variantName: values.newProductVariantName?.trim() ?? "",
          }
        : null,
    packaging,
    preparationTimeMinutes: values.preparationTimeMinutes,
    productId: values.productId,
    productVariantId:
      values.outputVariantMode === "existing" ? (values.productVariantId ?? null) : null,
    recipeName: values.recipeName,
  };
}

function toUpdateRecipePayload(values: CreateRecipeFormValues): UpdateRecipePayload {
  return {
    batchYieldQuantity: values.batchYieldQuantity,
    batchYieldUnitId: values.batchYieldUnitId,
    description: values.description,
    instructions: values.instructions,
    newProductVariant:
      values.outputVariantMode === "new"
        ? {
            salePrice: values.newProductVariantSalePrice ?? 0,
            sku: values.newProductVariantSku,
            variantName: values.newProductVariantName?.trim() ?? "",
          }
        : null,
    preparationTimeMinutes: values.preparationTimeMinutes,
    productId: values.productId,
    productVariantId:
      values.outputVariantMode === "existing" ? (values.productVariantId ?? null) : null,
    recipeName: values.recipeName,
  };
}

function componentUnitCost(
  products: RecipeProductOption[],
  componentProductId: string,
  componentVariantId: string | null,
): number {
  const product = products.find((item) => item.id === componentProductId);
  const variant =
    product?.variants.find((productVariant) => productVariant.id === componentVariantId) ?? null;

  return variant?.costPrice ?? product?.costPrice ?? 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function RecipeFormPage({
  onClose,
  onSaved,
  presentation = "page",
  recipeId,
}: RecipeFormPageProps): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission, hasPermission } = usePermission();
  // TODO: Remove products.* fallback once recipes.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.recipesView, PERMISSIONS.productsView]);
  const isCreate = recipeId === null;
  const canCreateRecipe = hasPermission(PERMISSIONS.recipesCreate);
  const canEditRecipe = hasPermission(PERMISSIONS.recipesEdit);
  const canUpdateRecipeStatus = hasPermission(PERMISSIONS.recipesStatusUpdate);
  const canRecalculateRecipeCost = hasPermission(PERMISSIONS.recipesCostRecalculate);
  const canCreateRecipeVersion = hasPermission(PERMISSIONS.recipesVersionsCreate);
  const canManageIngredients = hasPermission(PERMISSIONS.recipesIngredientsManage);
  const canManagePackaging = hasPermission(PERMISSIONS.recipesPackagingManage);
  const canSaveRecipe = isCreate ? canCreateRecipe : canEditRecipe;
  const canEditRecipeForm = canSaveRecipe;
  const canManageRecipeIngredients = canSaveRecipe || canManageIngredients;
  const canManageRecipePackaging = canSaveRecipe || canManagePackaging;
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredientPayload[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<RecipePackagingPayload[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const recipeQuery = useRecipe(recipeId, recipeId !== null);
  const referenceQuery = useRecipeReferenceData(true);
  const canCreateProduct = hasAnyPermission([PERMISSIONS.productsCreate]);
  const productReferenceDataQuery = useProductReferenceData(canCreateProduct);
  const createProductMutation = useCreateProduct();
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const statusMutation = useUpdateRecipeStatus();
  const form = useForm<CreateRecipeInputValues, unknown, CreateRecipeFormValues>({
    resolver: zodResolver(createRecipeSchema),
    defaultValues: emptyValues,
  });
  const isDialog = presentation === "dialog";

  useEffect(() => {
    if (recipeQuery.data) {
      form.reset({
        batchYieldQuantity: recipeQuery.data.batchYieldQuantity,
        batchYieldUnitId: recipeQuery.data.batchYieldUnitId,
        description: recipeQuery.data.description,
        ingredients: [],
        instructions: recipeQuery.data.instructions,
        newProductVariantName: "",
        newProductVariantSalePrice: null,
        newProductVariantSku: null,
        outputVariantMode: recipeQuery.data.productVariantId ? "existing" : "parent",
        packaging: [],
        preparationTimeMinutes: recipeQuery.data.preparationTimeMinutes,
        productId: recipeQuery.data.productId,
        productVariantId: recipeQuery.data.productVariantId ?? "",
        recipeName: recipeQuery.data.recipeName,
      });
    }
  }, [form, recipeQuery.data]);

  const saveRecipe = async (
    values: CreateRecipeFormValues,
    options: { activateAfterSave?: boolean } = {},
  ): Promise<void> => {
    try {
      if (isCreate) {
        const payload = toCreateRecipePayload(values, draftIngredients, draftPackaging);
        const created = await createMutation.mutateAsync(payload);
        if (options.activateAfterSave) {
          await statusMutation.mutateAsync({
            id: created.id,
            payload: { isActive: true, status: "active" },
          });
        }
        toast.success(
          options.activateAfterSave ? "Recipe created and activated." : "Recipe created.",
        );
        onSaved?.();
        if (isDialog) {
          onClose?.();
        } else {
          router.replace(`${ROUTES.recipes}/${created.id}`);
        }
        return;
      }

      if (recipeId) {
        await updateMutation.mutateAsync({
          id: recipeId,
          payload: toUpdateRecipePayload(values),
        });
        if (options.activateAfterSave) {
          await statusMutation.mutateAsync({
            id: recipeId,
            payload: { isActive: true, status: "active" },
          });
        }
        toast.success(
          options.activateAfterSave ? "Recipe saved and activated." : "Recipe updated.",
        );
        onSaved?.();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const activateRecipe = async (): Promise<void> => {
    if (!recipeId) {
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: recipeId,
        payload: { isActive: true, status: "active" },
      });
      toast.success("Recipe activated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const fieldError = (name: keyof CreateRecipeFormValues): string | undefined => {
    const error = form.formState.errors[name];
    return typeof error?.message === "string" ? error.message : undefined;
  };

  const showValidationToast = (errors: FieldErrors<CreateRecipeInputValues>): void => {
    const missingFields = [
      errors.productId ? "Product" : null,
      errors.productVariantId ? "Product variant" : null,
      errors.newProductVariantName ? "New variant name" : null,
      errors.newProductVariantSalePrice ? "New variant sale price" : null,
      errors.recipeName ? "Recipe name" : null,
      errors.batchYieldQuantity ? "Yield quantity" : null,
      errors.batchYieldUnitId ? "Yield unit" : null,
    ].filter((field): field is string => field !== null);

    toast.error(
      missingFields.length > 0
        ? `Complete required recipe fields: ${missingFields.join(", ")}.`
        : "Complete the highlighted recipe fields before saving.",
    );
  };

  const data = referenceQuery.data ?? {
    componentProducts: [],
    products: [],
    units: [],
  };
  const recipe = recipeQuery.data ?? null;
  const selectedProductId = form.watch("productId");
  const batchYieldQuantity = form.watch("batchYieldQuantity");
  const outputVariantMode = form.watch("outputVariantMode");
  const selectedVariantId = form.watch("productVariantId") ?? "";
  const selectedProduct = data.products.find((product) => product.id === selectedProductId) ?? null;
  const selectedProductVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);
  const ingredientComponentProducts = useMemo(
    () =>
      data.componentProducts.filter((product) =>
        [
          "finished_product",
          "ingredient",
          "raw_material",
          "semi_finished",
          "consumable",
          "equipment",
        ].includes(product.productType),
      ),
    [data.componentProducts],
  );
  const packagingComponentProducts = useMemo(
    () => data.componentProducts.filter((product) => product.productType === "packaging"),
    [data.componentProducts],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending || statusMutation.isPending;
  const liveCostPreview = useMemo<RecipeLiveCostPreview>(() => {
    const ingredientCost = draftIngredients.reduce((total, line) => {
      const unitCost = componentUnitCost(
        data.componentProducts,
        line.componentProductId,
        line.componentVariantId,
      );
      const effectiveQuantity = line.quantityRequired * (1 + line.wastagePercentage / 100);

      return total + effectiveQuantity * unitCost;
    }, 0);
    const packagingCost = draftPackaging.reduce((total, line) => {
      const unitCost = componentUnitCost(
        data.componentProducts,
        line.componentProductId,
        line.componentVariantId,
      );

      return total + line.quantityRequired * unitCost;
    }, 0);
    const totalCost = ingredientCost + packagingCost;
    const yieldQuantityValid = Number.isFinite(batchYieldQuantity) && batchYieldQuantity > 0;
    const hasZeroCostComponents =
      draftIngredients.some(
        (line) =>
          componentUnitCost(
            data.componentProducts,
            line.componentProductId,
            line.componentVariantId,
          ) <= 0,
      ) ||
      draftPackaging.some(
        (line) =>
          componentUnitCost(
            data.componentProducts,
            line.componentProductId,
            line.componentVariantId,
          ) <= 0,
      );

    return {
      batchYieldQuantity: yieldQuantityValid ? batchYieldQuantity : 0,
      costPerYieldUnit: yieldQuantityValid ? roundMoney(totalCost / batchYieldQuantity) : 0,
      estimatedIngredientCost: roundMoney(ingredientCost),
      estimatedPackagingCost: roundMoney(packagingCost),
      estimatedTotalCost: roundMoney(totalCost),
      hasLines: draftIngredients.length > 0 || draftPackaging.length > 0,
      hasZeroCostComponents,
      yieldQuantityValid,
    };
  }, [batchYieldQuantity, data.componentProducts, draftIngredients, draftPackaging]);
  const productOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      data.products.map((product) => ({
        value: product.id,
        label: product.productName,
        description:
          product.variants.length > 0
            ? `${product.variants.length.toLocaleString()} variants available`
            : "Parent product output",
        keywords: [
          product.productName,
          product.productCode,
          product.sku ?? "",
          product.barcode ?? "",
          PRODUCT_TYPE_LABELS[product.productType],
          ITEM_STRUCTURE_LABELS[product.itemStructure],
          ...product.variants.flatMap((variant) => [
            variant.variantName,
            variant.sku ?? "",
            variant.barcode ?? "",
            String(variant.salePrice),
          ]),
        ],
      })),
    [data.products],
  );
  const variantOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      selectedProductVariants.map((variant) => ({
        value: variant.id,
        label: variant.variantName,
        description: `AED ${variant.salePrice.toFixed(2)}${variant.sku ? ` · ${variant.sku}` : ""}`,
        keywords: [variant.variantName, variant.sku ?? "", String(variant.salePrice)],
      })),
    [selectedProductVariants],
  );
  const unitOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      data.units.map((unit) => ({
        value: unit.id,
        label: `${unit.unitName} (${unit.unitSymbol})`,
        description: unit.unitSymbol,
        keywords: [unit.unitName, unit.unitSymbol],
      })),
    [data.units],
  );

  const handleProductChange = (productId: string): void => {
    const currentRecipeName = form.getValues("recipeName").trim();
    const previousProduct = data.products.find((product) => product.id === selectedProductId);
    const nextProduct = data.products.find((product) => product.id === productId);
    const shouldAutoFillRecipeName =
      currentRecipeName.length === 0 ||
      (previousProduct
        ? currentRecipeName === previousProduct.productName ||
          currentRecipeName === `${previousProduct.productName} Recipe`
        : false);

    form.setValue("productId", productId, { shouldDirty: true, shouldValidate: true });
    form.setValue("outputVariantMode", "parent", { shouldDirty: true, shouldValidate: true });
    form.setValue("productVariantId", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantName", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantSku", null, { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantSalePrice", null, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (nextProduct && shouldAutoFillRecipeName) {
      form.setValue("recipeName", nextProduct.productName, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (nextProduct?.unitId && !form.getValues("batchYieldUnitId")) {
      form.setValue("batchYieldUnitId", nextProduct.unitId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const createProductFromRecipe = async (payload: CreateProductPayload): Promise<void> => {
    try {
      const createdProduct = await createProductMutation.mutateAsync(payload);
      await referenceQuery.refetch();
      handleProductChange(createdProduct.id);

      if (!form.getValues("batchYieldUnitId")) {
        form.setValue("batchYieldUnitId", createdProduct.unitId, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (!form.getValues("recipeName").trim()) {
        form.setValue("recipeName", createdProduct.productName, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      setProductDialogOpen(false);
      toast.success("Product created and selected for this recipe.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const recipeActionButtons = (
    <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
      <Button
        onClick={() => {
          if (isDialog) {
            onClose?.();
            return;
          }

          router.push(ROUTES.recipes);
        }}
        type="button"
        variant="outline"
      >
        Cancel
      </Button>
      <Button disabled={!canSaveRecipe || isSaving} type="submit" variant="outline">
        {isSaving ? "Saving..." : isCreate ? "Save draft" : "Save changes"}
      </Button>
      <Button
        disabled={!canSaveRecipe || !canUpdateRecipeStatus || isSaving}
        onClick={() => {
          void form.handleSubmit(
            (values) => saveRecipe(values, { activateAfterSave: true }),
            showValidationToast,
          )();
        }}
        type="button"
      >
        {isSaving ? "Saving..." : "Save & activate"}
      </Button>
      {!canSaveRecipe ? (
        <p className="text-xs text-red-700">
          You do not have permission to {isCreate ? "create" : "edit"} recipes.
        </p>
      ) : !canUpdateRecipeStatus ? (
        <p className="text-xs text-brand-mocha">
          Save is available. Activation requires recipe status permission.
        </p>
      ) : null}
    </div>
  );

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div
      className={
        isDialog
          ? "mx-auto flex h-full min-h-0 max-h-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-2xl"
          : "mx-auto flex max-w-7xl flex-col gap-6"
      }
    >
      {isDialog ? (
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-5 py-5 sm:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">
              Recipe Builder
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Define how finished and semi-finished products are made.
            </p>
          </div>
          <Button aria-label="Close recipe builder" onClick={onClose} type="button" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
        </div>
      ) : null}
      {isDialog ? null : (
        <RecipeHeader
          canActivate={canUpdateRecipeStatus}
          canCreateVersion={canCreateRecipeVersion}
          onActivate={() => {
            void activateRecipe();
          }}
          onCreateVersion={() => setVersionOpen(true)}
          recipe={recipe}
        />
      )}

      <form
        className={isDialog ? "min-h-0 flex-1 overflow-hidden" : "grid gap-6"}
        onSubmit={(event) => {
          void form.handleSubmit((values) => saveRecipe(values), showValidationToast)(event);
        }}
      >
        <div
          className={
            isDialog
              ? "grid h-full min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]"
              : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
          }
        >
          <div
            className={
              isDialog
                ? "flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8"
                : "flex flex-col gap-6"
            }
          >
            <Card className="rounded-2xl border-workspace-border bg-white shadow-none">
              <CardHeader className="border-b border-workspace-border pb-4">
                <CardTitle className="text-2xl text-brand-espresso">Recipe Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Product</Label>
                    {canCreateProduct ? (
                      <Button
                        disabled={!canEditRecipeForm || productReferenceDataQuery.isLoading}
                        onClick={() => setProductDialogOpen(true)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <PackagePlus className="h-4 w-4" />
                        Create Product
                      </Button>
                    ) : null}
                  </div>
                  <SearchableCombobox
                    disabled={!canEditRecipeForm}
                    emptyMessage="No matching products found."
                    onValueChange={handleProductChange}
                    options={productOptions}
                    placeholder="Select product"
                    searchPlaceholder="Search product, variant, SKU..."
                    value={selectedProductId}
                  />
                  {fieldError("productId") ? (
                    <span className="text-sm text-red-700">{fieldError("productId")}</span>
                  ) : null}
                </div>
                <label className="grid gap-2">
                  <Label>Recipe output</Label>
                  <Select
                    disabled={!canEditRecipeForm || selectedProductId.length === 0}
                    onValueChange={(value) => {
                      const nextMode = value as CreateRecipeFormValues["outputVariantMode"];
                      form.setValue("outputVariantMode", nextMode);
                      form.setValue("productVariantId", "");
                      form.setValue("newProductVariantName", "");
                      form.setValue("newProductVariantSku", null);
                      form.setValue("newProductVariantSalePrice", null);
                    }}
                    value={outputVariantMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select output stock target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">
                        Parent product stock
                        {selectedProduct ? ` (${selectedProduct.productName})` : ""}
                      </SelectItem>
                      <SelectItem value="existing" disabled={selectedProductVariants.length === 0}>
                        Existing product variant
                      </SelectItem>
                      <SelectItem value="new">Create new product variant</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                {outputVariantMode === "existing" ? (
                  <label className="grid gap-2">
                    <Label>Product variant</Label>
                    <SearchableCombobox
                      disabled={!canEditRecipeForm}
                      emptyMessage="No matching variants found."
                      onValueChange={(value) => form.setValue("productVariantId", value)}
                      options={variantOptions}
                      placeholder="Select variant"
                      searchPlaceholder="Search variant, SKU..."
                      value={selectedVariantId}
                    />
                    {fieldError("productVariantId") ? (
                      <span className="text-sm text-red-700">{fieldError("productVariantId")}</span>
                    ) : null}
                  </label>
                ) : null}
                {outputVariantMode === "new" ? (
                  <div className="grid gap-4 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/50 p-4 lg:col-span-2 lg:grid-cols-3">
                    <label className="grid gap-2">
                      <Label htmlFor="new-variant-name">New variant name</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="new-variant-name"
                        placeholder="Small / Large / Mocktail"
                        {...form.register("newProductVariantName")}
                      />
                      {fieldError("newProductVariantName") ? (
                        <span className="text-sm text-red-700">
                          {fieldError("newProductVariantName")}
                        </span>
                      ) : null}
                    </label>
                    <label className="grid gap-2">
                      <Label htmlFor="new-variant-sku">Variant SKU</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="new-variant-sku"
                        placeholder="Optional"
                        {...form.register("newProductVariantSku")}
                      />
                    </label>
                    <label className="grid gap-2">
                      <Label htmlFor="new-variant-price">Variant sale price</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="new-variant-price"
                        min="0"
                        step="0.01"
                        type="number"
                        {...form.register("newProductVariantSalePrice")}
                      />
                      {fieldError("newProductVariantSalePrice") ? (
                        <span className="text-sm text-red-700">
                          {fieldError("newProductVariantSalePrice")}
                        </span>
                      ) : null}
                    </label>
                  </div>
                ) : null}
                <label className="grid gap-2">
                  <Label htmlFor="recipe-name">Recipe name</Label>
                  <Input
                    disabled={!canEditRecipeForm}
                    id="recipe-name"
                    {...form.register("recipeName")}
                  />
                  {fieldError("recipeName") ? (
                    <span className="text-sm text-red-700">{fieldError("recipeName")}</span>
                  ) : null}
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <Label htmlFor="recipe-description">Description</Label>
                  <Textarea
                    className="min-h-20"
                    disabled={!canEditRecipeForm}
                    id="recipe-description"
                    {...form.register("description")}
                  />
                </label>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-workspace-border bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl text-brand-espresso">This Recipe Makes</CardTitle>
                <p className="text-sm text-brand-mocha">
                  Tell the system how much finished output this recipe produces. It is used to
                  calculate cost per unit.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <Label htmlFor="yield-quantity">Yield quantity</Label>
                  <Input
                    disabled={!canEditRecipeForm}
                    id="yield-quantity"
                    min="0.01"
                    step="0.01"
                    type="number"
                    {...form.register("batchYieldQuantity")}
                  />
                </label>
                <label className="grid gap-2">
                  <Label>Yield unit</Label>
                  <SearchableCombobox
                    disabled={!canEditRecipeForm}
                    emptyMessage="No matching units found."
                    onValueChange={(value) => form.setValue("batchYieldUnitId", value)}
                    options={unitOptions}
                    placeholder="Select unit"
                    searchPlaceholder="Search unit..."
                    value={form.watch("batchYieldUnitId")}
                  />
                </label>
                <label className="grid gap-2">
                  <Label htmlFor="prep-time">Preparation minutes</Label>
                  <Input
                    disabled={!canEditRecipeForm}
                    id="prep-time"
                    min="0"
                    step="1"
                    type="number"
                    {...form.register("preparationTimeMinutes")}
                  />
                </label>
              </CardContent>
            </Card>

            <RecipeIngredientsSection
              canManage={canManageRecipeIngredients}
              componentProducts={ingredientComponentProducts}
              draftLines={draftIngredients}
              onDraftLinesChange={setDraftIngredients}
              recipeId={recipeId}
              units={data.units}
            />
            <RecipePackagingSection
              canManage={canManageRecipePackaging}
              componentProducts={packagingComponentProducts}
              draftLines={draftPackaging}
              onDraftLinesChange={setDraftPackaging}
              recipeId={recipeId}
              units={data.units}
            />
            <Card className="rounded-2xl border-workspace-border bg-white shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl text-brand-espresso">
                  Production Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="min-h-44"
                  disabled={!canEditRecipeForm}
                  placeholder="1. Mix ingredients...\n2. Rest or proof...\n3. Bake or finish..."
                  {...form.register("instructions")}
                />
              </CardContent>
            </Card>
            {recipe ? <RecipeInstructionsCard instructions={recipe.instructions} /> : null}
          </div>

          <div
            className={
              isDialog
                ? "min-h-0 overflow-y-auto overscroll-contain border-t border-neutral-200 bg-neutral-50 px-5 py-5 lg:border-l lg:border-t-0"
                : "flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start"
            }
          >
            <div className="flex flex-col gap-5">
              {canSaveRecipe || canUpdateRecipeStatus ? (
                <Card className="rounded-2xl border-workspace-border bg-white shadow-none">
                  <CardHeader>
                    <CardTitle className="text-2xl text-brand-espresso">Builder Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-brand-mocha">
                      Save the recipe with its BOM lines in one flow. Activate it when it is ready
                      for manufacturing.
                    </p>
                    {recipeActionButtons}
                  </CardContent>
                </Card>
              ) : null}
              <RecipeCostCard
                canRecalculate={canRecalculateRecipeCost}
                draftIngredientCount={draftIngredients.length}
                draftPackagingCount={draftPackaging.length}
                livePreview={liveCostPreview}
                recipeId={recipeId}
              />
              <RecipeYieldCard recipe={recipe} />
            </div>
          </div>
        </div>

        {!isDialog && (canSaveRecipe || canUpdateRecipeStatus) ? (
          <div className="rounded-3xl border border-brand-cappuccino bg-white/80 p-4 shadow-sm xl:hidden">
            {recipeActionButtons}
          </div>
        ) : null}
      </form>

      <ProductFormDialog
        onClose={() => setProductDialogOpen(false)}
        onCreate={createProductFromRecipe}
        onUpdate={() => Promise.resolve()}
        open={productDialogOpen}
        product={null}
        referenceData={
          productReferenceDataQuery.data ?? {
            categories: [],
            taxRates: [],
            units: [],
          }
        }
        submitting={createProductMutation.isPending}
      />

      <RecipeVersionDialog
        onClose={() => setVersionOpen(false)}
        open={versionOpen}
        recipeId={recipeId}
      />
    </div>
  );
}
