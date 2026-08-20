"use client";

import { CalendarPlus, Factory } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatches } from "@/hooks/use-manufacturing";
import { useAssignProduction, useCreateOrderItemProduction } from "@/hooks/use-orders";
import { useRecipeByProduct, useRecipeIngredients, useRecipeLookup } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import { toDateOnlyInputValue } from "@/lib/utils/date-only";
import type { BakeryOrder } from "@/types/orders";
import type { Recipe } from "@/types/recipes";

type ProductionItemForm = {
  itemId: string;
  notes: string;
  plannedQuantity: string;
  productionDate: string;
  recipeId: string;
  recipeSearch: string;
};

const NO_VALID_RECIPE_MESSAGE =
  "No valid recipe found for this product. Please create or select a recipe before creating production.";

function isActiveRecipe(recipe: Recipe | undefined): recipe is Recipe {
  return recipe !== undefined && recipe.isActive && recipe.status === "active";
}

function recipeMatchesSelectedItem(recipe: Recipe, item: BakeryOrder["items"][number]): boolean {
  return recipe.productId === item.productId && recipe.productVariantId === item.productVariantId;
}

export function OrderProductionSection({
  canManage,
  order,
}: {
  canManage: boolean;
  order: BakeryOrder | null;
}): JSX.Element {
  const [batchId, setBatchId] = useState("");
  const [productionForm, setProductionForm] = useState<ProductionItemForm>({
    itemId: "",
    notes: "",
    plannedQuantity: "",
    productionDate: order ? toDateOnlyInputValue(order.eventDate) : "",
    recipeId: "",
    recipeSearch: "",
  });
  const batchesQuery = useBatches(
    { branchId: "", dateFrom: "", dateTo: "", productId: "", search: "", status: "all" },
    order !== null,
  );
  const assignMutation = useAssignProduction();
  const createProductionMutation = useCreateOrderItemProduction();
  const recipesQuery = useRecipeLookup(productionForm.recipeSearch, order !== null && canManage);
  const selectedItem = order?.items.find((item) => item.id === productionForm.itemId) ?? null;
  const selectedItemProductId =
    selectedItem && selectedItem.itemSource !== "custom" ? selectedItem.productId : null;
  const productRecipeQuery = useRecipeByProduct(
    selectedItemProductId,
    selectedItem?.productVariantId ?? null,
    order !== null && canManage && selectedItemProductId !== null,
  );
  const productRecipe = isActiveRecipe(productRecipeQuery.data) ? productRecipeQuery.data : null;
  const selectedLookupRecipe = (recipesQuery.data ?? []).find(
    (recipe) => recipe.id === productionForm.recipeId,
  );
  const selectedRecipe =
    productRecipe?.id === productionForm.recipeId ? productRecipe : selectedLookupRecipe;
  const selectedRecipeId =
    selectedItem !== null && productionForm.recipeId.trim().length > 0
      ? productionForm.recipeId
      : null;
  const recipeIngredientsQuery = useRecipeIngredients(selectedRecipeId, selectedRecipeId !== null);
  const selectedRecipeHasBom =
    recipeIngredientsQuery.data !== undefined && recipeIngredientsQuery.data.length > 0;
  const hasSelectedValidRecipe =
    selectedItem !== null &&
    productionForm.recipeId.trim().length > 0 &&
    isActiveRecipe(selectedRecipe) &&
    selectedRecipeHasBom &&
    (selectedItem.itemSource === "custom" ||
      recipeMatchesSelectedItem(selectedRecipe, selectedItem));
  const catalogItemMissingProduct =
    selectedItem !== null &&
    selectedItem.itemSource !== "custom" &&
    selectedItem.productId === null;
  const productRecipeUnavailable =
    selectedItem !== null &&
    selectedItem.itemSource !== "custom" &&
    !catalogItemMissingProduct &&
    !productRecipeQuery.isLoading &&
    productRecipe === null;
  const customItemMissingRecipe =
    selectedItem !== null &&
    selectedItem.itemSource === "custom" &&
    productionForm.recipeId.trim().length === 0;
  const selectedRecipeMissingBom =
    selectedRecipeId !== null && !recipeIngredientsQuery.isLoading && !selectedRecipeHasBom;
  const recipeValidationMessage =
    selectedItem !== null &&
    (catalogItemMissingProduct ||
      customItemMissingRecipe ||
      productRecipeUnavailable ||
      selectedRecipeMissingBom ||
      (productionForm.recipeId.trim().length > 0 && !hasSelectedValidRecipe))
      ? NO_VALID_RECIPE_MESSAGE
      : null;
  const plannedQuantity = Number(productionForm.plannedQuantity);
  const hasValidPlannedQuantity =
    productionForm.plannedQuantity.trim().length > 0 &&
    Number.isFinite(plannedQuantity) &&
    plannedQuantity > 0;
  const hasValidProductionDate = productionForm.productionDate.trim().length > 0;
  const createProductionDisabled =
    !canManage ||
    selectedItem === null ||
    productRecipeQuery.isLoading ||
    recipeIngredientsQuery.isLoading ||
    !hasSelectedValidRecipe ||
    !hasValidPlannedQuantity ||
    !hasValidProductionDate ||
    createProductionMutation.isPending;
  const recipeOptions = useMemo<SearchableComboboxOption[]>(() => {
    const recipes = productRecipe
      ? [
          productRecipe,
          ...(recipesQuery.data ?? []).filter((recipe) => recipe.id !== productRecipe.id),
        ]
      : (recipesQuery.data ?? []);

    return recipes.map((recipe) => ({
      value: recipe.id,
      label: recipe.recipeName,
      description: [recipe.recipeCode, recipe.productName, recipe.productVariantName]
        .filter((part): part is string => typeof part === "string" && part.length > 0)
        .join(" - "),
      keywords: [recipe.recipeName, recipe.recipeCode, recipe.productName],
    }));
  }, [productRecipe, recipesQuery.data]);

  useEffect(() => {
    if (!selectedItem || selectedItem.itemSource === "custom") {
      return;
    }
    if (productRecipe && productionForm.recipeId !== productRecipe.id) {
      setProductionForm((current) => ({ ...current, recipeId: productRecipe.id }));
    }
  }, [productRecipe, productionForm.recipeId, selectedItem]);

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-card/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Production Link</h2>
      <p className="mt-1 text-sm text-brand-mocha">
        Attach this order to an existing manufacturing batch.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Select disabled={!order || !canManage} onValueChange={setBatchId} value={batchId}>
          <SelectTrigger>
            <SelectValue placeholder="Select production batch" />
          </SelectTrigger>
          <SelectContent>
            {(batchesQuery.data ?? []).map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.batchNumber} · {batch.productName} · {batch.status.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!order || !canManage || !batchId || assignMutation.isPending}
          onClick={() => {
            void (async () => {
              if (!order || !batchId) {
                return;
              }
              try {
                await assignMutation.mutateAsync({ orderId: order.id, payload: { batchId } });
                toast.success("Production batch assigned.");
              } catch (error: unknown) {
                toast.error(getErrorMessage(error));
              }
            })();
          }}
          type="button"
        >
          <Factory className="h-4 w-4" />
          Assign
        </Button>
      </div>
      {!order ? (
        <p className="mt-3 text-sm text-brand-mocha">Save the order before linking production.</p>
      ) : null}
      {order ? (
        <div className="mt-6 border-t border-brand-cappuccino/60 pt-5">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-brand-espresso">Create production from item</h3>
            <p className="text-sm text-brand-mocha">
              Create a manufacturing batch from a saved bakery order item.
            </p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="order-production-section-order-item"
                className="text-sm font-medium text-brand-espresso"
              >
                Order item
              </label>
              <Select
                disabled={!canManage || order.items.length === 0}
                onValueChange={(itemId) => {
                  const item = order.items.find((entry) => entry.id === itemId);
                  setProductionForm((current) => ({
                    ...current,
                    itemId,
                    notes: item
                      ? `Bakery order ${order.orderNumber} item ${item.itemNameSnapshot}`
                      : current.notes,
                    plannedQuantity: item ? String(item.quantity) : current.plannedQuantity,
                    productionDate: toDateOnlyInputValue(order.eventDate),
                    recipeId: "",
                    recipeSearch: "",
                  }));
                }}
                value={productionForm.itemId}
              >
                <SelectTrigger id="order-production-section-order-item">
                  <SelectValue placeholder="Select item to produce" />
                </SelectTrigger>
                <SelectContent>
                  {order.items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.itemNameSnapshot} - Qty {item.quantity} {item.unitName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="order-production-section-recipe"
                className="text-sm font-medium text-brand-espresso"
              >
                Recipe {selectedItem?.itemSource === "custom" ? "(required for custom item)" : ""}
              </label>
              <SearchableCombobox
                id="order-production-section-recipe"
                disabled={!canManage || !productionForm.itemId}
                emptyMessage={NO_VALID_RECIPE_MESSAGE}
                isLoading={recipesQuery.isLoading}
                onSearchChange={(recipeSearch) =>
                  setProductionForm((current) => ({ ...current, recipeSearch }))
                }
                onValueChange={(recipeId) =>
                  setProductionForm((current) => ({ ...current, recipeId }))
                }
                options={recipeOptions}
                placeholder="Use linked recipe or select one"
                searchPlaceholder="Search recipe..."
                searchValue={productionForm.recipeSearch}
                value={productionForm.recipeId}
              />
              {recipeValidationMessage ? (
                <p className="text-sm text-danger-text">{recipeValidationMessage}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label
                htmlFor="order-production-section-planned-quantity"
                className="text-sm font-medium text-brand-espresso"
              >
                Planned quantity
              </label>
              <Input
                id="order-production-section-planned-quantity"
                disabled={!canManage || !productionForm.itemId}
                min="0"
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    plannedQuantity: event.target.value,
                  }))
                }
                placeholder={selectedItem ? String(selectedItem.quantity) : "Order item quantity"}
                type="number"
                value={productionForm.plannedQuantity}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="order-production-section-production-date"
                className="text-sm font-medium text-brand-espresso"
              >
                Production date
              </label>
              <Input
                id="order-production-section-production-date"
                disabled={!canManage || !productionForm.itemId}
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    productionDate: event.target.value,
                  }))
                }
                type="date"
                value={productionForm.productionDate}
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label
                htmlFor="order-production-section-notes"
                className="text-sm font-medium text-brand-espresso"
              >
                Notes
              </label>
              <Input
                id="order-production-section-notes"
                disabled={!canManage || !productionForm.itemId}
                onChange={(event) =>
                  setProductionForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Production notes"
                value={productionForm.notes}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={createProductionDisabled}
            onClick={() => {
              void (async () => {
                if (!selectedItem) {
                  return;
                }
                if (!hasSelectedValidRecipe) {
                  toast.error(NO_VALID_RECIPE_MESSAGE);
                  return;
                }

                try {
                  await createProductionMutation.mutateAsync({
                    itemId: selectedItem.id,
                    orderId: order.id,
                    payload: {
                      notes: productionForm.notes,
                      plannedQuantity,
                      productionDate: productionForm.productionDate,
                      recipeId: productionForm.recipeId,
                    },
                  });
                  toast.success("Production batch created from order item.");
                  setProductionForm({
                    itemId: "",
                    notes: "",
                    plannedQuantity: "",
                    productionDate: toDateOnlyInputValue(order.eventDate),
                    recipeId: "",
                    recipeSearch: "",
                  });
                } catch (error: unknown) {
                  toast.error(getErrorMessage(error));
                }
              })();
            }}
            type="button"
          >
            <CalendarPlus className="h-4 w-4" />
            Create production
          </Button>
        </div>
      ) : null}
    </section>
  );
}
