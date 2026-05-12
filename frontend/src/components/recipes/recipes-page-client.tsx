"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/recipes/access-denied-card";
import { RecipeDetailsDrawer } from "@/components/recipes/recipe-details-drawer";
import { RecipeVersionDialog } from "@/components/recipes/recipe-version-dialog";
import { RecipesEmptyState } from "@/components/recipes/recipes-empty-state";
import { RecipesErrorState } from "@/components/recipes/recipes-error-state";
import { RecipesSummaryCards } from "@/components/recipes/recipes-summary-cards";
import { RecipesTable } from "@/components/recipes/recipes-table";
import { RecipesTableSkeleton } from "@/components/recipes/recipes-table-skeleton";
import { RecipesToolbar } from "@/components/recipes/recipes-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useDeleteRecipe,
  useRecipeReferenceData,
  useRecipes,
  useUpdateRecipeStatus,
} from "@/hooks/use-recipes";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { Recipe, RecipeFilters, RecipeStatus } from "@/types/recipes";

const defaultFilters: RecipeFilters = {
  active: "all",
  productId: "all",
  search: "",
  status: "all",
};

type PendingAction =
  | { recipe: Recipe; type: "delete" }
  | { isActive: boolean | undefined; recipe: Recipe; status: RecipeStatus; type: "status" }
  | null;

export function RecipesPageClient(): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  // TODO: Remove products.* fallback once recipes.* permissions are seeded for every tenant.
  const canView = hasAnyPermission([PERMISSIONS.recipesView, PERMISSIONS.productsView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.recipesCreate,
    PERMISSIONS.recipesEdit,
    PERMISSIONS.recipesDelete,
    PERMISSIONS.recipesStatusUpdate,
    PERMISSIONS.recipesIngredientsManage,
    PERMISSIONS.recipesPackagingManage,
    PERMISSIONS.recipesCostRecalculate,
    PERMISSIONS.recipesVersionsCreate,
  ]);
  const [filters, setFilters] = useState<RecipeFilters>(defaultFilters);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [drawerRecipe, setDrawerRecipe] = useState<Recipe | null>(null);
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null);
  const recipesQuery = useRecipes(filters, canView);
  const referenceQuery = useRecipeReferenceData(canView);
  const statusMutation = useUpdateRecipeStatus();
  const deleteMutation = useDeleteRecipe();
  const isPermissionDenied =
    recipesQuery.error instanceof ApiError && recipesQuery.error.status === 403;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const recipes = recipesQuery.data ?? [];

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) {
      return;
    }

    try {
      if (pendingAction.type === "delete") {
        await deleteMutation.mutateAsync(pendingAction.recipe.id);
        toast.success("Recipe deleted.");
      } else {
        await statusMutation.mutateAsync({
          id: pendingAction.recipe.id,
          payload: {
            status: pendingAction.status,
            ...(pendingAction.isActive !== undefined ? { isActive: pendingAction.isActive } : {}),
          },
        });
        toast.success("Recipe status updated.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="Define BOM ingredients, packaging, yield, and cost for manufactured products."
        actions={
          canManage ? (
            <Button onClick={() => router.push(`${ROUTES.recipes}/new`)} type="button">
              <Plus className="h-4 w-4" />
              Create Recipe
            </Button>
          ) : undefined
        }
      />

      <RecipesSummaryCards recipes={recipes} />

      <RecipesToolbar
        filters={filters}
        onFiltersChange={setFilters}
        products={referenceQuery.data?.products ?? []}
      />

      {recipesQuery.isLoading ? <RecipesTableSkeleton /> : null}

      {!recipesQuery.isLoading && recipesQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the recipes endpoint." />
        ) : (
          <RecipesErrorState
            description={getErrorMessage(recipesQuery.error)}
            onRetry={() => {
              void recipesQuery.refetch();
            }}
          />
        )
      ) : null}

      {!recipesQuery.isLoading && !recipesQuery.error && recipes.length === 0 ? (
        <RecipesEmptyState
          canManage={canManage}
          onCreate={() => router.push(`${ROUTES.recipes}/new`)}
        />
      ) : null}

      {!recipesQuery.isLoading && !recipesQuery.error && recipes.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <RecipesTable
              canManage={canManage}
              onCreateVersion={setVersionRecipe}
              onDelete={(recipe) => setPendingAction({ recipe, type: "delete" })}
              onStatusChange={(recipe, status, isActive) =>
                setPendingAction({ isActive, recipe, status, type: "status" })
              }
              recipes={recipes}
            />
          </CardContent>
        </Card>
      ) : null}

      <RecipeDetailsDrawer
        onOpenChange={(open) => {
          if (!open) {
            setDrawerRecipe(null);
          }
        }}
        open={drawerRecipe !== null}
        recipe={drawerRecipe}
      />

      <RecipeVersionDialog
        onClose={() => setVersionRecipe(null)}
        open={versionRecipe !== null}
        recipeId={versionRecipe?.id ?? null}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete recipe" : "Change recipe status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This removes the recipe from active BOM workflows."
                : `Update ${pendingAction?.recipe.recipeName ?? "recipe"} to ${pendingAction?.status ?? "status"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={statusMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                void confirmAction();
              }}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
