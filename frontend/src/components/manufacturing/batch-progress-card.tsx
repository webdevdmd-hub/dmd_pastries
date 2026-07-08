import type { JSX } from "react";

import { isBatchPlannedStatus } from "@/lib/manufacturing/batch-status";
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchProgressCard({ batch }: { batch: ProductionBatch }): JSX.Element {
  const progress =
    batch.plannedQuantity > 0
      ? Math.min((batch.producedQuantity / batch.plannedQuantity) * 100, 100)
      : 0;
  const remaining = Math.max(batch.plannedQuantity - batch.producedQuantity, 0);

  return (
    <section className="rounded-2xl border border-neutral-300 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-950">
          Production Progress
        </h2>
        <p className="font-mono text-xl font-semibold text-neutral-950">{progress.toFixed(0)}%</p>
      </div>
      <div className="mt-5 space-y-5">
        {isBatchPlannedStatus(batch.status) ? (
          <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-950">Planned production</p>
            <p className="mt-1">
              No stock has been consumed or produced yet, and no accounting journal has been posted.
            </p>
          </div>
        ) : null}
        <div className="h-3 rounded-full bg-neutral-200">
          <div className="h-3 rounded-full bg-black" style={{ width: `${progress.toFixed(0)}%` }} />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-500">Planned</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-neutral-950">
              {batch.plannedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-500">Produced</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-neutral-950">
              {batch.producedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
            <p className="text-sm text-neutral-500">Remaining</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-neutral-950">
              {remaining} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Wastage</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-red-700">
              {batch.wastageQuantity} {batch.batchUnitName}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
