"use client";

import { CalendarPlus, Factory } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
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
import { useRecipeLookup } from "@/hooks/use-recipes";
import { getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

type ProductionItemForm = {
  itemId: string;
  notes: string;
  plannedQuantity: string;
  productionDate: string;
  recipeId: string;
  recipeSearch: string;
};

function dateInputValue(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : "";
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
    productionDate: order ? dateInputValue(order.eventDate) : "",
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
  const recipeOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (recipesQuery.data ?? []).map((recipe) => ({
        value: recipe.id,
        label: recipe.recipeName,
        description: [recipe.recipeCode, recipe.productName, recipe.productVariantName]
          .filter((part): part is string => typeof part === "string" && part.length > 0)
          .join(" - "),
        keywords: [recipe.recipeName, recipe.recipeCode, recipe.productName],
      })),
    [recipesQuery.data],
  );

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
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
              <label className="text-sm font-medium text-brand-espresso">Order item</label>
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
                    productionDate: dateInputValue(order.eventDate),
                    recipeId: "",
                    recipeSearch: "",
                  }));
                }}
                value={productionForm.itemId}
              >
                <SelectTrigger>
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
              <label className="text-sm font-medium text-brand-espresso">
                Recipe {selectedItem?.itemSource === "custom" ? "(required for custom item)" : ""}
              </label>
              <SearchableCombobox
                disabled={!canManage || !productionForm.itemId}
                emptyMessage="No recipes found."
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
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-brand-espresso">Planned quantity</label>
              <Input
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
              <label className="text-sm font-medium text-brand-espresso">Production date</label>
              <Input
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
              <label className="text-sm font-medium text-brand-espresso">Notes</label>
              <Input
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
            disabled={!canManage || !productionForm.itemId || createProductionMutation.isPending}
            onClick={() => {
              void (async () => {
                if (!selectedItem) {
                  return;
                }
                if (selectedItem.itemSource === "custom" && !productionForm.recipeId) {
                  toast.error("Select a recipe before creating production for a custom item.");
                  return;
                }

                const plannedQuantity = Number(productionForm.plannedQuantity);

                try {
                  await createProductionMutation.mutateAsync({
                    itemId: selectedItem.id,
                    orderId: order.id,
                    payload: {
                      notes: productionForm.notes,
                      plannedQuantity: Number.isFinite(plannedQuantity) ? plannedQuantity : null,
                      productionDate: productionForm.productionDate,
                      recipeId: productionForm.recipeId,
                    },
                  });
                  toast.success("Production batch created from order item.");
                  setProductionForm({
                    itemId: "",
                    notes: "",
                    plannedQuantity: "",
                    productionDate: dateInputValue(order.eventDate),
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
