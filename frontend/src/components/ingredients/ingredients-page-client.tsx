"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/ingredients/access-denied-card";
import { IngredientFormDialog } from "@/components/ingredients/ingredient-form-dialog";
import { IngredientsEmptyState } from "@/components/ingredients/ingredients-empty-state";
import { IngredientsErrorState } from "@/components/ingredients/ingredients-error-state";
import { IngredientsSummaryCards } from "@/components/ingredients/ingredients-summary-cards";
import { IngredientsTable } from "@/components/ingredients/ingredients-table";
import { IngredientsTableSkeleton } from "@/components/ingredients/ingredients-table-skeleton";
import { IngredientsToolbar } from "@/components/ingredients/ingredients-toolbar";
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
import {
  useCreateIngredient,
  useDeleteIngredient,
  useIngredientCategories,
  useIngredients,
  useIngredientSupplierLookup,
  useIngredientUnits,
  useUpdateIngredient,
  useUpdateIngredientStatus,
} from "@/hooks/use-ingredients";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import {
  getHistoryDeleteConflictMessage,
  isHistoryDeleteConflict,
} from "@/lib/api/delete-conflicts";
import type {
  CreateIngredientPayload,
  Ingredient,
  IngredientFilters,
  IngredientStatus,
  UpdateIngredientPayload,
} from "@/types/ingredient";

const defaultFilters: IngredientFilters = {
  categoryId: "all",
  search: "",
  status: "all",
  stockTracked: "all",
  supplierId: "all",
};

type PendingAction =
  | { item: Ingredient; status: IngredientStatus; type: "status" }
  | { item: Ingredient; type: "delete" }
  | null;

export function IngredientsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.ingredientsView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ingredientsCreate,
    PERMISSIONS.ingredientsEdit,
    PERMISSIONS.ingredientsDelete,
    PERMISSIONS.ingredientsStatusUpdate,
  ]);
  const [filters, setFilters] = useState<IngredientFilters>(defaultFilters);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const ingredientsQuery = useIngredients(filters, canView);
  const categoriesQuery = useIngredientCategories(canView);
  const suppliersQuery = useIngredientSupplierLookup("", canView);
  const unitsQuery = useIngredientUnits(canView);
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient();
  const statusMutation = useUpdateIngredientStatus();
  const deleteMutation = useDeleteIngredient();
  const isPermissionDenied =
    ingredientsQuery.error instanceof ApiError && ingredientsQuery.error.status === 403;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const openCreate = (): void => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreateIngredientPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Ingredient created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateIngredientPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Ingredient updated.");
      setEditingItem(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "status") {
        await statusMutation.mutateAsync({
          id: pendingAction.item.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Ingredient status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.item.id);
        toast.success("Ingredient deleted.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(
        pendingAction.type === "delete" && isHistoryDeleteConflict(error)
          ? getHistoryDeleteConflictMessage("ingredient")
          : getErrorMessage(error),
      );
      setPendingAction(null);
    }
  };

  const categories = categoriesQuery.data ?? [];
  const items = (ingredientsQuery.data ?? []).map((item) => ({
    ...item,
    ingredientCategoryName:
      item.ingredientCategoryName !== "Uncategorized"
        ? item.ingredientCategoryName
        : (categories.find((category) => category.id === item.ingredientCategoryId)?.categoryName ??
          item.ingredientCategoryName),
  }));
  const suppliers = suppliersQuery.data ?? [];
  const units = unitsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Ingredients"
        description="Manage raw materials used by recipes, manufacturing, purchasing, and inventory."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Add Ingredient
            </Button>
          ) : undefined
        }
      />

      <IngredientsSummaryCards items={items} />

      <IngredientsToolbar
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        suppliers={suppliers}
      />

      {ingredientsQuery.isLoading ? <IngredientsTableSkeleton /> : null}

      {!ingredientsQuery.isLoading && ingredientsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the ingredients endpoint." />
        ) : (
          <IngredientsErrorState
            description={getErrorMessage(ingredientsQuery.error)}
            onRetry={() => {
              void ingredientsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!ingredientsQuery.isLoading && !ingredientsQuery.error && items.length === 0 ? (
        <IngredientsEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {!ingredientsQuery.isLoading && !ingredientsQuery.error && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <IngredientsTable
              canManage={canManage}
              items={items}
              onDelete={(item) => setPendingAction({ item, type: "delete" })}
              onEdit={(item) => {
                setEditingItem(item);
                setFormOpen(true);
              }}
              onStatusChange={(item, status) => setPendingAction({ item, status, type: "status" })}
            />
          </CardContent>
        </Card>
      ) : null}

      <IngredientFormDialog
        categories={categories}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        item={editingItem}
        onClose={() => {
          setEditingItem(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        suppliers={suppliers}
        units={units}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete ingredient" : "Change ingredient status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This soft-deletes the ingredient from active catalog workflows."
                : `Update ${pendingAction?.item.ingredientName ?? "ingredient"} to ${pendingAction?.status ?? "status"}?`}
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
