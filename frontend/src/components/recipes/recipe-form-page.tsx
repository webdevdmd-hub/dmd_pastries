"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/recipes/access-denied-card";
import { RecipeCostCard } from "@/components/recipes/recipe-cost-card";
import { RecipeHeader } from "@/components/recipes/recipe-header";
import { RecipeIngredientsSection } from "@/components/recipes/recipe-ingredients-section";
import { RecipeInstructionsCard } from "@/components/recipes/recipe-instructions-card";
import { RecipePackagingSection } from "@/components/recipes/recipe-packaging-section";
import { RecipeVersionDialog } from "@/components/recipes/recipe-version-dialog";
import { RecipeYieldCard } from "@/components/recipes/recipe-yield-card";
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

type RecipeFormPageProps = {
  recipeId: string | null;
};

const emptyValues: CreateRecipeInputValues = {
  batchYieldQuantity: 1,
  batchYieldUnitId: "",
  description: null,
  ingredients: [],
  instructions: null,
  packaging: [],
  preparationTimeMinutes: 0,
  productId: "",
  recipeName: "",
};

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
  const [versionOpen, setVersionOpen] = useState(false);
  const recipeQuery = useRecipe(recipeId, recipeId !== null);
  const referenceQuery = useRecipeReferenceData(true);
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
        packaging: [],
        preparationTimeMinutes: recipeQuery.data.preparationTimeMinutes,
        productId: recipeQuery.data.productId,
        recipeName: recipeQuery.data.recipeName,
      });
    }
  }, [form, recipeQuery.data]);

  const saveRecipe = async (values: CreateRecipeFormValues): Promise<void> => {
    try {
      if (isCreate) {
        const created = await createMutation.mutateAsync({
          ...values,
          description: values.description,
          instructions: values.instructions,
          preparationTimeMinutes: values.preparationTimeMinutes,
        });
        toast.success("Recipe created.");
        router.replace(`${ROUTES.recipes}/${created.id}`);
        return;
      }

      if (recipeId) {
        await updateMutation.mutateAsync({
          id: recipeId,
          payload: {
            ...values,
            description: values.description,
            instructions: values.instructions,
            preparationTimeMinutes: values.preparationTimeMinutes,
          },
        });
        toast.success("Recipe updated.");
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
    inventoryItems: [],
    packagingItems: [],
    products: [],
    units: [],
  };
  const recipe = recipeQuery.data ?? null;

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
          void form.handleSubmit(saveRecipe)(event);
        }}
      >
        <Card className="bg-white/80">
          <CardHeader>
            <CardTitle>Basic information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <Label>Product</Label>
              <Select
                disabled={!canManage}
                onValueChange={(value) => form.setValue("productId", value)}
                value={form.watch("productId")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {data.products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("productId") ? (
                <span className="text-sm text-red-700">{fieldError("productId")}</span>
              ) : null}
            </label>
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
                  <Select
                    disabled={!canManage}
                    onValueChange={(value) => form.setValue("batchYieldUnitId", value)}
                    value={form.watch("batchYieldUnitId")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.unitName} ({unit.unitSymbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              inventoryItems={data.inventoryItems}
              onCreateRecipe={() => {
                void form.handleSubmit(saveRecipe)();
              }}
              recipeId={recipeId}
              savingRecipe={createMutation.isPending}
              units={data.units}
            />
          </div>

          <div className="space-y-6">
            <RecipeYieldCard recipe={recipe} />
            <RecipeCostCard canManage={canManage} recipeId={recipeId} />
            <RecipePackagingSection
              canManage={canManage}
              onCreateRecipe={() => {
                void form.handleSubmit(saveRecipe)();
              }}
              packagingItems={data.packagingItems}
              recipeId={recipeId}
              savingRecipe={createMutation.isPending}
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
          <div className="flex justify-end gap-3">
            <Button onClick={() => router.push(ROUTES.recipes)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
              {isCreate ? "Create recipe" : "Save recipe"}
            </Button>
          </div>
        ) : null}
      </form>

      <RecipeVersionDialog
        onClose={() => setVersionOpen(false)}
        open={versionOpen}
        recipeId={recipeId}
      />
    </div>
  );
}
