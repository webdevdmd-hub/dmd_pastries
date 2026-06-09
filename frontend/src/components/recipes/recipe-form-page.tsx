"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { AccessDeniedCard } from "@/components/recipes/access-denied-card";
import { RecipeCostCard } from "@/components/recipes/recipe-cost-card";
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
import type { CreateProductPayload } from "@/types/product";
import type {
  CreateRecipePayload,
  RecipeIngredientPayload,
  RecipePackagingPayload,
  UpdateRecipePayload,
} from "@/types/recipes";

type RecipeFormPageProps = {
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

export function RecipeFormPage({ recipeId }: RecipeFormPageProps): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  // TODO: Remove products.* fallback once recipes.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.recipesView, PERMISSIONS.productsView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.recipesCreate,
    PERMISSIONS.recipesEdit,
    PERMISSIONS.recipesStatusUpdate,
    PERMISSIONS.recipesIngredientsManage,
    PERMISSIONS.recipesPackagingManage,
    PERMISSIONS.recipesCostRecalculate,
    PERMISSIONS.recipesVersionsCreate,
  ]);
  const isCreate = recipeId === null;
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
        router.replace(`${ROUTES.recipes}/${created.id}`);
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

  const data = referenceQuery.data ?? {
    componentProducts: [],
    products: [],
    units: [],
  };
  const recipe = recipeQuery.data ?? null;
  const selectedProductId = form.watch("productId");
  const outputVariantMode = form.watch("outputVariantMode");
  const selectedVariantId = form.watch("productVariantId") ?? "";
  const selectedProduct = data.products.find((product) => product.id === selectedProductId) ?? null;
  const selectedProductVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);
  const packagingComponentProducts = useMemo(
    () => data.componentProducts.filter((product) => product.productType === "packaging"),
    [data.componentProducts],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending || statusMutation.isPending;
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
          ...product.variants.flatMap((variant) => [
            variant.variantName,
            variant.sku ?? "",
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
    form.setValue("productId", productId, { shouldDirty: true, shouldValidate: true });
    form.setValue("outputVariantMode", "parent", { shouldDirty: true, shouldValidate: true });
    form.setValue("productVariantId", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantName", "", { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantSku", null, { shouldDirty: true, shouldValidate: true });
    form.setValue("newProductVariantSalePrice", null, {
      shouldDirty: true,
      shouldValidate: true,
    });
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
        form.setValue("recipeName", `${createdProduct.productName} Recipe`, {
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
      <Button onClick={() => router.push(ROUTES.recipes)} type="button" variant="outline">
        Cancel
      </Button>
      <Button disabled={isSaving} type="submit" variant="outline">
        {isCreate ? "Save draft" : "Save changes"}
      </Button>
      <Button
        disabled={isSaving}
        onClick={() => {
          void form.handleSubmit((values) => saveRecipe(values, { activateAfterSave: true }))();
        }}
        type="button"
      >
        Save & activate
      </Button>
    </div>
  );

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <RecipeHeader
        canManage={canManage}
        onActivate={() => {
          void activateRecipe();
        }}
        onCreateVersion={() => setVersionOpen(true)}
        recipe={recipe}
      />

      <form
        className="grid gap-6"
        onSubmit={(event) => {
          void form.handleSubmit((values) => saveRecipe(values))(event);
        }}
      >
        <Card className="bg-white/80">
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Product</Label>
                {canCreateProduct ? (
                  <Button
                    disabled={!canManage || productReferenceDataQuery.isLoading}
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
                disabled={!canManage}
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
                disabled={!canManage || selectedProductId.length === 0}
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
                    Parent product stock{selectedProduct ? ` (${selectedProduct.productName})` : ""}
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
                  disabled={!canManage}
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
                    disabled={!canManage}
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
                    disabled={!canManage}
                    id="new-variant-sku"
                    placeholder="Optional"
                    {...form.register("newProductVariantSku")}
                  />
                </label>
                <label className="grid gap-2">
                  <Label htmlFor="new-variant-price">Variant sale price</Label>
                  <Input
                    disabled={!canManage}
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
              <Input disabled={!canManage} id="recipe-name" {...form.register("recipeName")} />
              {fieldError("recipeName") ? (
                <span className="text-sm text-red-700">{fieldError("recipeName")}</span>
              ) : null}
            </label>
            <label className="grid gap-2 lg:col-span-2">
              <Label htmlFor="recipe-description">Description</Label>
              <Input
                disabled={!canManage}
                id="recipe-description"
                {...form.register("description")}
              />
            </label>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <Card className="bg-white/80">
              <CardHeader>
                <CardTitle>Yield & preparation</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <Label htmlFor="yield-quantity">Yield quantity</Label>
                  <Input
                    disabled={!canManage}
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
                    disabled={!canManage}
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
                    disabled={!canManage}
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
              canManage={canManage}
              componentProducts={data.componentProducts}
              draftLines={draftIngredients}
              onDraftLinesChange={setDraftIngredients}
              recipeId={recipeId}
              units={data.units}
            />
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            {canManage ? (
              <Card className="bg-white/90">
                <CardHeader>
                  <CardTitle>Builder actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-brand-mocha">
                    Save the recipe with its BOM lines in one flow. Activate it when it is ready for
                    manufacturing.
                  </p>
                  {recipeActionButtons}
                </CardContent>
              </Card>
            ) : null}
            <RecipeYieldCard recipe={recipe} />
            <RecipeCostCard
              canManage={canManage}
              draftIngredientCount={draftIngredients.length}
              draftPackagingCount={draftPackaging.length}
              recipeId={recipeId}
            />
            <RecipePackagingSection
              canManage={canManage}
              componentProducts={packagingComponentProducts}
              draftLines={draftPackaging}
              onDraftLinesChange={setDraftPackaging}
              recipeId={recipeId}
              units={data.units}
            />
            <Card className="bg-white/80">
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="min-h-36 w-full rounded-2xl border border-brand-cappuccino bg-brand-latte px-4 py-3 text-sm text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel"
                  disabled={!canManage}
                  {...form.register("instructions")}
                />
              </CardContent>
            </Card>
            {recipe ? <RecipeInstructionsCard instructions={recipe.instructions} /> : null}
          </div>
        </div>

        {canManage ? (
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
