"use client";

import { PackagePlus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddOrderPackaging, useOrderPackaging } from "@/hooks/use-orders";
import { usePackaging } from "@/hooks/use-packaging";
import { getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

export function OrderPackagingSection({
  canManage,
  order,
}: {
  canManage: boolean;
  order: BakeryOrder | null;
}): JSX.Element {
  const [packagingItemId, setPackagingItemId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState(1);
  const packagingQuery = usePackaging(
    { categoryId: "", search: "", status: "active", stockTracked: "all", supplierId: "" },
    order !== null,
  );
  const orderPackagingQuery = useOrderPackaging(order?.id ?? null, order !== null);
  const addPackagingMutation = useAddOrderPackaging();
  const selectedPackaging = (packagingQuery.data ?? []).find((item) => item.id === packagingItemId);

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <h2 className="text-xl font-semibold text-brand-espresso">Packaging</h2>
      <p className="mt-1 text-sm text-brand-mocha">
        Attach boxes, trays, labels, or packaging items.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <Select
          disabled={!order || !canManage}
          onValueChange={setPackagingItemId}
          value={packagingItemId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select packaging" />
          </SelectTrigger>
          <SelectContent>
            {(packagingQuery.data ?? []).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.packagingName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          min={1}
          onChange={(event) => setQuantityRequired(Number(event.target.value))}
          type="number"
          value={quantityRequired}
        />
        <Button
          disabled={!order || !canManage || !packagingItemId || addPackagingMutation.isPending}
          onClick={() => {
            void (async () => {
              if (!order || !packagingItemId) {
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
            Save the order before adding packaging.
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
