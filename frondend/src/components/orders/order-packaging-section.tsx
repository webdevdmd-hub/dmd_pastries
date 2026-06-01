"use client";

import { PackagePlus, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddOrderPackaging, useOrderPackaging } from "@/hooks/use-orders";
import { usePackaging } from "@/hooks/use-packaging";
import { getErrorMessage } from "@/lib/api/client";
import type { AddOrderPackagingPayload, BakeryOrder } from "@/types/orders";

export function OrderPackagingSection({
  canManage,
  draftPackaging = [],
  onDraftPackagingChange,
  order,
}: {
  canManage: boolean;
  draftPackaging?: AddOrderPackagingPayload[];
  onDraftPackagingChange?: (lines: AddOrderPackagingPayload[]) => void;
  order: BakeryOrder | null;
}): JSX.Element {
  const [packagingItemId, setPackagingItemId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState(1);
  const packagingQuery = usePackaging(
    { categoryId: "", search: "", status: "active", stockTracked: "all", supplierId: "" },
    canManage,
  );
  const orderPackagingQuery = useOrderPackaging(order?.id ?? null, order !== null);
  const addPackagingMutation = useAddOrderPackaging();
  const selectedPackaging = (packagingQuery.data ?? []).find((item) => item.id === packagingItemId);
  const packagingOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      (packagingQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.packagingName,
        description: [
          item.packagingCode,
          item.packagingCategoryName,
          item.unitName ? `${item.unitName}${item.unitSymbol ? ` (${item.unitSymbol})` : ""}` : "",
        ]
          .filter((part) => part.length > 0)
          .join(" - "),
        keywords: [
          item.packagingName,
          item.packagingCode,
          item.packagingCategoryName,
          item.unitName,
          item.unitSymbol,
        ],
      })),
    [packagingQuery.data],
  );

  const addDraftPackaging = (): void => {
    if (!selectedPackaging || !onDraftPackagingChange) {
      return;
    }

    onDraftPackagingChange([
      ...draftPackaging,
      {
        packagingItemId: selectedPackaging.id,
        quantityRequired,
        unitId: selectedPackaging.unitId,
      },
    ]);
    setPackagingItemId("");
    setQuantityRequired(1);
  };

  const packagingName = (packagingId: string): string =>
    (packagingQuery.data ?? []).find((item) => item.id === packagingId)?.packagingName ??
    "Packaging item";

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Packaging</h2>
      <p className="mt-1 text-sm text-brand-mocha">
        Attach boxes, trays, labels, or packaging items.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <SearchableCombobox
          disabled={!canManage}
          emptyMessage="No matching packaging items found."
          isLoading={packagingQuery.isLoading}
          loadingMessage="Loading packaging items..."
          onRetry={() => void packagingQuery.refetch()}
          onValueChange={setPackagingItemId}
          options={packagingOptions}
          placeholder="Select packaging"
          searchPlaceholder="Search packaging, code, category..."
          value={packagingItemId}
        />
        <Input
          min={1}
          onChange={(event) => setQuantityRequired(Number(event.target.value))}
          type="number"
          value={quantityRequired}
        />
        <Button
          disabled={!canManage || !packagingItemId || addPackagingMutation.isPending}
          onClick={() => {
            void (async () => {
              if (!packagingItemId) {
                return;
              }
              if (!order) {
                addDraftPackaging();
                return;
              }
              try {
                await addPackagingMutation.mutateAsync({
                  orderId: order.id,
                  payload: {
                    packagingItemId,
                    quantityRequired,
                    unitId: selectedPackaging?.unitId ?? "",
                  },
                });
                setPackagingItemId("");
                setQuantityRequired(1);
                toast.success("Packaging added.");
              } catch (error: unknown) {
                toast.error(getErrorMessage(error));
              }
            })();
          }}
          type="button"
        >
          <PackagePlus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="mt-4 grid gap-2">
        {!order
          ? draftPackaging.map((entry, index) => (
              <div
                className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
                key={`${entry.packagingItemId}-${String(index)}`}
              >
                <span className="font-medium text-brand-espresso">
                  {packagingName(entry.packagingItemId)}
                </span>
                <span className="flex items-center gap-3 text-brand-mocha">
                  Qty {entry.quantityRequired}
                  <Button
                    aria-label="Remove draft packaging"
                    onClick={() =>
                      onDraftPackagingChange?.(
                        draftPackaging.filter((_line, lineIndex) => lineIndex !== index),
                      )
                    }
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </Button>
                </span>
              </div>
            ))
          : null}
        {(orderPackagingQuery.data ?? []).map((entry) => (
          <div
            className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
            key={entry.id}
          >
            <span className="font-medium text-brand-espresso">{entry.packagingName}</span>
            <span className="text-brand-mocha">Qty {entry.quantityRequired}</span>
          </div>
        ))}
        {!order ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            Add packaging now. It will be saved automatically when you create the order.
          </p>
        ) : null}
        {order &&
        !orderPackagingQuery.isLoading &&
        (orderPackagingQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            No packaging linked yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
