"use client";

import { Factory } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatches } from "@/hooks/use-manufacturing";
import { useAssignProduction } from "@/hooks/use-orders";
import { getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

export function OrderProductionSection({
  canManage,
  order,
}: {
  canManage: boolean;
  order: BakeryOrder | null;
}): JSX.Element {
  const [batchId, setBatchId] = useState("");
  const batchesQuery = useBatches(
    { branchId: "", dateFrom: "", dateTo: "", productId: "", search: "", status: "all" },
    order !== null,
  );
  const assignMutation = useAssignProduction();

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
    </section>
  );
}
