"use client";

import { ArrowLeft, Edit3, Wheat } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/ingredients/access-denied-card";
import { IngredientFormDialog } from "@/components/ingredients/ingredient-form-dialog";
import { IngredientStatusBadge } from "@/components/ingredients/ingredient-status-badge";
import { IngredientsErrorState } from "@/components/ingredients/ingredients-error-state";
import { IngredientsTableSkeleton } from "@/components/ingredients/ingredients-table-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import {
  useIngredient,
  useIngredientCategories,
  useIngredientSupplierLookup,
  useIngredientUnits,
  useUpdateIngredient,
} from "@/hooks/use-ingredients";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { UpdateIngredientPayload } from "@/types/ingredient";

type IngredientDetailsPageClientProps = {
  ingredientId: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

export function IngredientDetailsPageClient({
  ingredientId,
}: IngredientDetailsPageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.ingredientsView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ingredientsEdit,
    PERMISSIONS.ingredientsStatusUpdate,
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const ingredientQuery = useIngredient(ingredientId, canView);
  const categoriesQuery = useIngredientCategories(canView);
  const suppliersQuery = useIngredientSupplierLookup("", canView);
  const unitsQuery = useIngredientUnits(canView);
  const updateMutation = useUpdateIngredient();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const item = ingredientQuery.data ?? null;

  const handleUpdate = async (id: string, payload: UpdateIngredientPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Ingredient updated.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (ingredientQuery.isLoading) {
    return <IngredientsTableSkeleton />;
  }

  if (ingredientQuery.error || !item) {
    return (
      <IngredientsErrorState
        description={getErrorMessage(ingredientQuery.error)}
        onRetry={() => {
          void ingredientQuery.refetch();
        }}
      />
    );
  }

  const categories = categoriesQuery.data ?? [];
  const displayItem = {
    ...item,
    ingredientCategoryName:
      item.ingredientCategoryName !== "Uncategorized"
        ? item.ingredientCategoryName
        : (categories.find((category) => category.id === item.ingredientCategoryId)?.categoryName ??
          item.ingredientCategoryName),
  };
  const imageUrl = getProductImagePreviewUrl(displayItem.imageFileId) ?? displayItem.imageUrl;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={displayItem.ingredientName}
        description={`${displayItem.ingredientCode} - Raw material profile for inventory, purchasing, and recipes.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline">
              <Link href={ROUTES.ingredients}>
                <ArrowLeft className="h-4 w-4" />
                Back to Ingredients
              </Link>
            </Button>
            {canManage ? (
              <Button onClick={() => setFormOpen(true)} type="button">
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ingredient Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              {imageUrl ? (
                <img
                  alt={displayItem.ingredientName}
                  className="h-48 w-full rounded-2xl object-cover"
                  src={imageUrl}
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-brand-cappuccino bg-brand-latte/70">
                  <Wheat className="h-12 w-12 text-brand-mocha" />
                </div>
              )}
            </div>
            <Detail label="Category" value={displayItem.ingredientCategoryName} />
            <Detail label="Supplier" value={displayItem.supplierName ?? "Not linked"} />
            <Detail label="Unit" value={`${displayItem.unitName} (${displayItem.unitSymbol})`} />
            <Detail label="Cost per unit" value={formatCurrency(displayItem.costPerUnit)} />
            <Detail
              label={<ReorderLevelHeader>Reorder level</ReorderLevelHeader>}
              value={`${String(displayItem.reorderLevel)} ${displayItem.unitSymbol}`}
            />
            <div className="grid gap-2">
              <span className="text-sm text-brand-mocha">Status</span>
              <IngredientStatusBadge status={displayItem.status} />
            </div>
            <div className="grid gap-2">
              <span className="text-sm text-brand-mocha">Stock tracked</span>
              <Badge variant="outline">
                {displayItem.isStockTracked ? "Tracked" : "Not tracked"}
              </Badge>
            </div>
            <div className="grid gap-2">
              <span className="text-sm text-brand-mocha">Expiry tracked</span>
              <Badge variant="outline">
                {displayItem.isExpiryTracked ? "Tracked" : "Not tracked"}
              </Badge>
            </div>
            <Detail label="Created by" value={displayItem.createdByUserName} />
            <Detail label="Updated at" value={formatDate(displayItem.updatedAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-brand-mocha">
            <p>
              If stock tracking is enabled, backend can auto-create the related inventory item. Use
              Inventory to manage branch quantities, adjustments, movements, and expiry batches.
            </p>
            <Button asChild type="button" variant="outline">
              <Link href={`${ROUTES.inventory}?itemType=ingredient`}>Open Inventory</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="text-brand-mocha">
            {displayItem.description ?? "No description added."}
          </CardContent>
        </Card>
      </div>

      <IngredientFormDialog
        categories={categoriesQuery.data ?? []}
        isSubmitting={updateMutation.isPending}
        item={displayItem}
        onClose={() => setFormOpen(false)}
        onCreate={() => Promise.resolve()}
        onUpdate={handleUpdate}
        open={formOpen}
        suppliers={suppliersQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />
    </div>
  );
}

function Detail({ label, value }: { label: JSX.Element | string; value: string }): JSX.Element {
  return (
    <div className="grid gap-1 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-3">
      <span className="text-sm text-brand-mocha">{label}</span>
      <strong className="text-brand-espresso">{value}</strong>
    </div>
  );
}
