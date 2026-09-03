"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/recipes/access-denied-card";
import { RecipeDetailsDrawer } from "@/components/recipes/recipe-details-drawer";
import { RecipeFormPage } from "@/components/recipes/recipe-form-page";
import { RecipeVersionDialog } from "@/components/recipes/recipe-version-dialog";
import { RecipesCardGrid } from "@/components/recipes/recipes-card-grid";
import { RecipesEmptyState } from "@/components/recipes/recipes-empty-state";
import { RecipesErrorState } from "@/components/recipes/recipes-error-state";
import { RecipesSummaryCards } from "@/components/recipes/recipes-summary-cards";
import { RecipesTable } from "@/components/recipes/recipes-table";
import { RecipesTableSkeleton } from "@/components/recipes/recipes-table-skeleton";
import { RecipesToolbar } from "@/components/recipes/recipes-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
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
  const [createOpen, setCreateOpen] = useState(false);
  // The recipe the builder dialog is editing, or null when it is creating.
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [drawerRecipe, setDrawerRecipe] = useState<Recipe | null>(null);
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null);
  const recipesQuery = useRecipes(filters, canView);
  const referenceQuery = useRecipeReferenceData(canView);
  const statusMutation = useUpdateRecipeStatus();
  const deleteMutation = useDeleteRecipe();
  const isPermissionDenied =
    recipesQuery.error instanceof ApiError && recipesQuery.error.status === 403;
  // Every field in this toolbar is user-chosen, so every field counts. There is
  // no branch scope and no paging here to exclude.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.active !== defaultFilters.active ||
    filters.productId !== defaultFilters.productId ||
    filters.status !== defaultFilters.status;

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

  const builderOpen = createOpen || editRecipe !== null;

  const closeBuilder = (): void => {
    setCreateOpen(false);
    setEditRecipe(null);
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before the builder or either confirmation opens.
  const openBuilder = (recipe: Recipe): void => {
    setDrawerRecipe(null);
    setEditRecipe(recipe);
  };

  const listHandlers = {
    canManage,
    onEdit: openBuilder,
    onCreateVersion: (recipe: Recipe) => {
      setDrawerRecipe(null);
      setVersionRecipe(recipe);
    },
    onDelete: (recipe: Recipe) => {
      setDrawerRecipe(null);
      setPendingAction({ recipe, type: "delete" });
    },
    onStatusChange: (recipe: Recipe, status: RecipeStatus, isActive?: boolean) => {
      setDrawerRecipe(null);
      setPendingAction({ isActive, recipe, status, type: "status" });
    },
    onView: setDrawerRecipe,
    recipes,
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Recipes"
        description="Define BOM ingredients, packaging, yield, and cost for manufactured products."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)} type="button">
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

      {/* Empty and filtered need opposite remedies. Offering "Create Recipe" to
          someone who filtered to a product with no BOM sends them off to build a
          recipe that already exists elsewhere. DESIGN.md 8. */}
      {!recipesQuery.isLoading &&
      !recipesQuery.error &&
      recipes.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="recipes"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!recipesQuery.isLoading &&
      !recipesQuery.error &&
      recipes.length === 0 &&
      !hasActiveFilters ? (
        <RecipesEmptyState canManage={canManage} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {!recipesQuery.isLoading && !recipesQuery.error && recipes.length > 0 ? (
        <>
          <div className="md:hidden">
            <RecipesCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <RecipesTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <RecipeDetailsDrawer
        canManage={canManage}
        onEdit={openBuilder}
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

      {/* One builder dialog for both intentions. Creating already opened the
          form this way; editing navigated to /recipes/[id] instead, so the two
          routes to the same form behaved differently and editing cost the
          operator their place in the list. The route still resolves for anyone
          arriving by URL. */}
      <Dialog open={builderOpen} onOpenChange={(open) => (!open ? closeBuilder() : undefined)}>
        <DialogContent
          className="flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-7xl gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{editRecipe ? "Edit recipe" : "Recipe Builder"}</DialogTitle>
            <DialogDescription>
              Define how finished and semi-finished products are made.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1">
            {/* Keyed by record: the builder holds a whole form state, so
                switching from one recipe to another must remount it rather
                than leave the previous recipe's drafts in place. */}
            <RecipeFormPage
              key={editRecipe?.id ?? "new"}
              onClose={closeBuilder}
              onSaved={() => {
                void recipesQuery.refetch();
              }}
              presentation="dialog"
              recipeId={editRecipe?.id ?? null}
            />
          </div>
        </DialogContent>
      </Dialog>

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
