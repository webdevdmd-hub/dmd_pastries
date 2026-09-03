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
import { RecipeCostCard } from "@/components/recipes/recipe-cost-card";
import { RecipeHeader } from "@/components/recipes/recipe-header";
import {
  type IngredientPreviewDraft,
  RecipeIngredientsSection,
} from "@/components/recipes/recipe-ingredients-section";
import {
  type PackagingPreviewDraft,
  RecipePackagingSection,
} from "@/components/recipes/recipe-packaging-section";
import { RecipeVersionDialog } from "@/components/recipes/recipe-version-dialog";
import { RecipeYieldCard, type RecipeYieldPreview } from "@/components/recipes/recipe-yield-card";
import { FormTabs } from "@/components/shared/form-tabs";
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
  useRecipeIngredients,
  useRecipePackaging,
  useRecipeReferenceData,
  useUpdateRecipe,
  useUpdateRecipeStatus,
} from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import {
  calculateRecipeLiveCostPreview,
  ingredientLineToCostInput,
  packagingLineToCostInput,
  type RecipeCostIngredientInput,
  type RecipeCostPackagingInput,
  type RecipeLiveCostPreview,
} from "@/lib/recipes/recipe-cost-preview";
import {
  hasSelfReferencingRecipeLine,
  RECIPE_SELF_REFERENCE_MESSAGE,
} from "@/lib/recipes/self-reference";
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

type RecipeBuilderTabKey = "details" | "ingredients" | "packaging" | "instructions";

const RECIPE_BUILDER_TABPANEL_ID = "recipe-builder-tabpanel";

function numberFieldValue(value: unknown): number | "" {
  if (typeof value === "string" && value.trim().length === 0) {
    return "";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : "";
}

function nullablePreviewNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

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
  // Four stacked cards became four tabs on one form state. The builder is the
  // longest form in the app: on a laptop the packaging section sat below the
  // fold of the ingredient section, which sat below the fold of the details.
  const [activeTab, setActiveTab] = useState<RecipeBuilderTabKey>("details");
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredientPayload[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<RecipePackagingPayload[]>([]);
  const [ingredientPreviewDraft, setIngredientPreviewDraft] =
    useState<IngredientPreviewDraft | null>(null);
  const [packagingPreviewDraft, setPackagingPreviewDraft] = useState<PackagingPreviewDraft | null>(
    null,
  );
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const recipeQuery = useRecipe(recipeId, recipeId !== null);
  const ingredientsQuery = useRecipeIngredients(recipeId, recipeId !== null);
  const packagingQuery = useRecipePackaging(recipeId, recipeId !== null);
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
    if (
      isCreate &&
      (hasSelfReferencingRecipeLine(values.productId, draftIngredients) ||
        hasSelfReferencingRecipeLine(values.productId, draftPackaging))
    ) {
      toast.error(RECIPE_SELF_REFERENCE_MESSAGE);
      return;
    }

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

    // Every validated field lives on Details, so a failed save returns there.
    // Without this the toast named fields on a tab the builder was not showing.
    setActiveTab("details");

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
  const batchYieldUnitId = form.watch("batchYieldUnitId");
  const outputVariantMode = form.watch("outputVariantMode");
  const preparationTimeMinutes = form.watch("preparationTimeMinutes");
  const selectedVariantId = form.watch("productVariantId") ?? "";
  const selectedProduct = data.products.find((product) => product.id === selectedProductId) ?? null;
  const selectedYieldUnit = data.units.find((unit) => unit.id === batchYieldUnitId) ?? null;
  const selectedProductVariants = useMemo(() => selectedProduct?.variants ?? [], [selectedProduct]);
  const ingredientComponentProducts = useMemo(
    () =>
      data.componentProducts.filter(
        (product) =>
          product.id !== selectedProductId &&
          [
            "finished_product",
            "ingredient",
            "raw_material",
            "semi_finished",
            "consumable",
            "equipment",
          ].includes(product.productType),
      ),
    [data.componentProducts, selectedProductId],
  );
  const packagingComponentProducts = useMemo(
    () =>
      data.componentProducts.filter(
        (product) => product.id !== selectedProductId && product.productType === "packaging",
      ),
    [data.componentProducts, selectedProductId],
  );
  const isSaving = createMutation.isPending || updateMutation.isPending || statusMutation.isPending;
  const liveCostPreview = useMemo<RecipeLiveCostPreview>(() => {
    const ingredientInputs: RecipeCostIngredientInput[] =
      recipeId === null
        ? [...draftIngredients]
        : (ingredientsQuery.data ?? []).map(ingredientLineToCostInput);
    const packagingInputs: RecipeCostPackagingInput[] =
      recipeId === null
        ? [...draftPackaging]
        : (packagingQuery.data ?? []).map(packagingLineToCostInput);

    if (ingredientPreviewDraft) {
      if (recipeId === null && ingredientPreviewDraft.draftIndex !== null) {
        ingredientInputs[ingredientPreviewDraft.draftIndex] = ingredientPreviewDraft.payload;
      } else if (recipeId !== null && ingredientPreviewDraft.lineId !== null) {
        const lineIndex = (ingredientsQuery.data ?? []).findIndex(
          (line) => line.id === ingredientPreviewDraft.lineId,
        );
        if (lineIndex >= 0) {
          ingredientInputs[lineIndex] = ingredientPreviewDraft.payload;
        }
      } else {
        ingredientInputs.push(ingredientPreviewDraft.payload);
      }
    }

    if (packagingPreviewDraft) {
      if (recipeId === null && packagingPreviewDraft.draftIndex !== null) {
        packagingInputs[packagingPreviewDraft.draftIndex] = packagingPreviewDraft.payload;
      } else if (recipeId !== null && packagingPreviewDraft.lineId !== null) {
        const lineIndex = (packagingQuery.data ?? []).findIndex(
          (line) => line.id === packagingPreviewDraft.lineId,
        );
        if (lineIndex >= 0) {
          packagingInputs[lineIndex] = packagingPreviewDraft.payload;
        }
      } else {
        packagingInputs.push(packagingPreviewDraft.payload);
      }
    }

    return calculateRecipeLiveCostPreview({
      batchYieldQuantity,
      componentProducts: data.componentProducts,
      ingredients: ingredientInputs,
      packaging: packagingInputs,
    });
  }, [
    batchYieldQuantity,
    data.componentProducts,
    draftIngredients,
    draftPackaging,
    ingredientPreviewDraft,
    ingredientsQuery.data,
    packagingPreviewDraft,
    packagingQuery.data,
    recipeId,
  ]);
  const previewIngredientCount =
    (recipeId === null ? draftIngredients.length : (ingredientsQuery.data?.length ?? 0)) +
    (ingredientPreviewDraft &&
    ((recipeId === null && ingredientPreviewDraft.draftIndex === null) ||
      (recipeId !== null && ingredientPreviewDraft.lineId === null))
      ? 1
      : 0);
  const previewPackagingCount =
    (recipeId === null ? draftPackaging.length : (packagingQuery.data?.length ?? 0)) +
    (packagingPreviewDraft &&
    ((recipeId === null && packagingPreviewDraft.draftIndex === null) ||
      (recipeId !== null && packagingPreviewDraft.lineId === null))
      ? 1
      : 0);
  const liveYieldPreview: RecipeYieldPreview = {
    batchYieldQuantity: numberFieldValue(batchYieldQuantity),
    batchYieldUnitName: selectedYieldUnit?.unitName ?? recipe?.batchYieldUnitName ?? null,
    preparationTimeMinutes: nullablePreviewNumber(preparationTimeMinutes),
  };
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
        <p className="text-xs text-danger-text">
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
          ? "mx-auto flex h-full min-h-0 min-w-0 max-h-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          : "mx-auto flex max-w-7xl flex-col gap-6"
      }
    >
      {isDialog ? (
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-8">
          <div>
            {/* The dialog's accessible name already says which of the two this
                is; the visible heading said "Recipe Builder" either way. */}
            <h2 className="text-section font-medium text-foreground">
              {isCreate ? "Recipe Builder" : (recipe?.recipeName ?? "Edit recipe")}
            </h2>
            <p className="mt-1 text-cell text-foreground-muted">
              {isCreate
                ? "Define how finished and semi-finished products are made."
                : "Edit this recipe's details, BOM lines and instructions."}
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
        className={isDialog ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : "grid gap-6"}
        onSubmit={(event) => {
          void form.handleSubmit((values) => saveRecipe(values), showValidationToast)(event);
        }}
      >
        {/* The strip sits outside the scrolling body. Inside it, scrolling the
            ingredient list carried the tabs 261px off the top of their own
            pane -- you could no longer see which section you were in, or
            leave it, without scrolling back up. */}
        <div
          className={
            isDialog ? "min-w-0 shrink-0 border-b border-border px-5 py-3 sm:px-8" : "min-w-0"
          }
        >
          <FormTabs
            active={activeTab}
            aria-label="Recipe builder sections"
            onTabChange={setActiveTab}
            panelId={RECIPE_BUILDER_TABPANEL_ID}
            tabs={[
              { key: "details", label: "Details" },
              { key: "ingredients", label: "Ingredients", badge: previewIngredientCount },
              { key: "packaging", label: "Packaging", badge: previewPackagingCount },
              { key: "instructions", label: "Instructions" },
            ]}
          />
        </div>

        {/* Below lg the two columns stack, and each keeping its own
            overflow-y-auto made the dialog two ~350px scroll windows one
            above the other. One scroller until the columns actually sit
            side by side. */}
        <div
          className={
            isDialog
              ? "grid min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden"
              : "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
          }
        >
          <div
            className={
              isDialog
                ? "flex min-h-0 min-w-0 flex-col gap-6 px-5 py-6 sm:px-8 lg:overflow-y-auto lg:overscroll-contain"
                : // A grid item defaults to min-width:auto, so without min-w-0
                  // this column grows to its widest child -- the four-tab strip --
                  // and drags the whole page into a horizontal scroll on a phone.
                  "flex min-w-0 flex-col gap-6"
            }
          >
            {/* One panel region for all four sections: the strip aria-controls
                this id, so it must not be the div that display:none hides. */}
            <div className="contents" id={RECIPE_BUILDER_TABPANEL_ID} role="tabpanel">
              <div className={activeTab === "details" ? "contents" : "hidden"}>
                <Card className="rounded-2xl border-workspace-border bg-card shadow-none">
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="recipe-form-page-product">Product</Label>
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
                        id="recipe-form-page-product"
                        disabled={!canEditRecipeForm}
                        emptyMessage="No matching products found."
                        onValueChange={handleProductChange}
                        options={productOptions}
                        placeholder="Select product"
                        searchPlaceholder="Search product, variant, SKU..."
                        value={selectedProductId}
                      />
                      {fieldError("productId") ? (
                        <span className="text-sm text-danger-text">{fieldError("productId")}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="recipe-form-page-recipe-output">Recipe output</Label>
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
                        <SelectTrigger id="recipe-form-page-recipe-output">
                          <SelectValue placeholder="Select output stock target" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parent">
                            Parent product stock
                            {selectedProduct ? ` (${selectedProduct.productName})` : ""}
                          </SelectItem>
                          <SelectItem
                            value="existing"
                            disabled={selectedProductVariants.length === 0}
                          >
                            Existing product variant
                          </SelectItem>
                          <SelectItem value="new">Create new product variant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {outputVariantMode === "existing" ? (
                      <div className="grid gap-2">
                        <Label htmlFor="recipe-form-page-product-variant">Product variant</Label>
                        <SearchableCombobox
                          id="recipe-form-page-product-variant"
                          disabled={!canEditRecipeForm}
                          emptyMessage="No matching variants found."
                          onValueChange={(value) => form.setValue("productVariantId", value)}
                          options={variantOptions}
                          placeholder="Select variant"
                          searchPlaceholder="Search variant, SKU..."
                          value={selectedVariantId}
                        />
                        {fieldError("productVariantId") ? (
                          <span className="text-sm text-danger-text">
                            {fieldError("productVariantId")}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {outputVariantMode === "new" ? (
                      <div className="grid gap-4 rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/50 p-4 lg:col-span-2 lg:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="new-variant-name">New variant name</Label>
                          <Input
                            disabled={!canEditRecipeForm}
                            id="new-variant-name"
                            placeholder="Small / Large / Mocktail"
                            {...form.register("newProductVariantName")}
                          />
                          {fieldError("newProductVariantName") ? (
                            <span className="text-sm text-danger-text">
                              {fieldError("newProductVariantName")}
                            </span>
                          ) : null}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="new-variant-sku">Variant SKU</Label>
                          <Input
                            disabled={!canEditRecipeForm}
                            id="new-variant-sku"
                            placeholder="Optional"
                            {...form.register("newProductVariantSku")}
                          />
                        </div>
                        <div className="grid gap-2">
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
                            <span className="text-sm text-danger-text">
                              {fieldError("newProductVariantSalePrice")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Label htmlFor="recipe-name">Recipe name</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="recipe-name"
                        {...form.register("recipeName")}
                      />
                      {fieldError("recipeName") ? (
                        <span className="text-sm text-danger-text">{fieldError("recipeName")}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 lg:col-span-2">
                      <Label htmlFor="recipe-description">Description</Label>
                      <Textarea
                        className="min-h-20"
                        disabled={!canEditRecipeForm}
                        id="recipe-description"
                        {...form.register("description")}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-workspace-border bg-card shadow-none">
                  <CardHeader>
                    <CardTitle className="text-2xl text-brand-espresso">
                      This Recipe Makes
                    </CardTitle>
                    <p className="text-sm text-brand-mocha">
                      Tell the system how much finished output this recipe produces. It is used to
                      calculate cost per unit.
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="yield-quantity">Yield quantity</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="yield-quantity"
                        min="0.01"
                        step="0.01"
                        type="number"
                        {...form.register("batchYieldQuantity", {
                          setValueAs: numberFieldValue,
                        })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="recipe-form-page-yield-unit">Yield unit</Label>
                      <SearchableCombobox
                        id="recipe-form-page-yield-unit"
                        disabled={!canEditRecipeForm}
                        emptyMessage="No matching units found."
                        onValueChange={(value) => form.setValue("batchYieldUnitId", value)}
                        options={unitOptions}
                        placeholder="Select unit"
                        searchPlaceholder="Search unit..."
                        value={batchYieldUnitId}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="prep-time">Preparation minutes</Label>
                      <Input
                        disabled={!canEditRecipeForm}
                        id="prep-time"
                        min="0"
                        step="1"
                        type="number"
                        {...form.register("preparationTimeMinutes", {
                          setValueAs: numberFieldValue,
                        })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className={activeTab === "ingredients" ? "contents" : "hidden"}>
                <RecipeIngredientsSection
                  canManage={canManageRecipeIngredients}
                  componentProducts={ingredientComponentProducts}
                  draftLines={draftIngredients}
                  onDraftLinesChange={setDraftIngredients}
                  onPreviewDraftChange={setIngredientPreviewDraft}
                  parentProductId={selectedProductId}
                  recipeId={recipeId}
                  units={data.units}
                />
              </div>

              <div className={activeTab === "packaging" ? "contents" : "hidden"}>
                <RecipePackagingSection
                  canManage={canManageRecipePackaging}
                  componentProducts={packagingComponentProducts}
                  draftLines={draftPackaging}
                  onDraftLinesChange={setDraftPackaging}
                  onPreviewDraftChange={setPackagingPreviewDraft}
                  parentProductId={selectedProductId}
                  recipeId={recipeId}
                  units={data.units}
                />
              </div>

              <div className={activeTab === "instructions" ? "contents" : "hidden"}>
                <Card className="rounded-2xl border-workspace-border bg-card shadow-none">
                  <CardHeader>
                    <CardTitle
                      className="text-2xl text-brand-espresso"
                      id="recipe-instructions-heading"
                    >
                      Production Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      aria-labelledby="recipe-instructions-heading"
                      className="min-h-44"
                      disabled={!canEditRecipeForm}
                      placeholder={"1. Mix ingredients…\n2. Rest or proof…\n3. Bake or finish…"}
                      {...form.register("instructions")}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div
            className={
              isDialog
                ? "min-h-0 border-t border-border bg-muted px-5 py-5 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0"
                : "flex flex-col gap-5 xl:sticky xl:top-6 xl:self-start"
            }
          >
            <div className="flex flex-col gap-5">
              {/* In the dialog the save buttons are a fixed footer, so this
                  card would be a second copy of them 286px down a pane the
                  operator had to discover. */}
              {!isDialog && (canSaveRecipe || canUpdateRecipeStatus) ? (
                <Card className="rounded-2xl border-workspace-border bg-card shadow-none">
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
                draftIngredientCount={previewIngredientCount}
                draftPackagingCount={previewPackagingCount}
                livePreview={liveCostPreview}
                recipeId={recipeId}
              />
              <RecipeYieldCard preview={liveYieldPreview} />
            </div>
          </div>
        </div>

        {/* Save belongs to the dialog, not to a card inside one of its two
            scrollers. It sat 286px down the sidebar, which meant scrolling a
            secondary pane to find the button that ends the task. */}
        {isDialog && (canSaveRecipe || canUpdateRecipeStatus) ? (
          <div className="min-w-0 shrink-0 border-t border-border bg-card px-5 py-4 sm:px-8">
            {recipeActionButtons}
          </div>
        ) : null}

        {!isDialog && (canSaveRecipe || canUpdateRecipeStatus) ? (
          <div className="rounded-3xl border border-brand-cappuccino bg-card/80 p-4 shadow-sm xl:hidden">
            {recipeActionButtons}
          </div>
        ) : null}
      </form>

      <ProductFormDialog
        defaultItemStructure="recipe_based"
        defaultProductType="finished_product"
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
