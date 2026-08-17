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
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-foreground">Production Progress</h2>
        <p className="font-mono text-xl font-semibold text-foreground">{progress.toFixed(0)}%</p>
      </div>
      <div className="mt-5 space-y-5">
        {isBatchPlannedStatus(batch.status) ? (
          <div className="rounded-xl border border-border bg-muted p-4 text-sm text-foreground-muted">
            <p className="font-semibold text-foreground">Planned production</p>
            <p className="mt-1">
              No stock has been consumed or produced yet, and no accounting journal has been posted.
            </p>
          </div>
        ) : null}
        <div className="h-3 rounded-full bg-muted">
          <div
            className="h-3 rounded-full bg-primary"
            style={{ width: `${progress.toFixed(0)}%` }}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm text-foreground-muted">Planned</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-foreground">
              {batch.plannedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm text-foreground-muted">Produced</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-foreground">
              {batch.producedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm text-foreground-muted">Remaining</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-foreground">
              {remaining} {batch.batchUnitName}
            </p>
          </div>
          <div className="rounded-xl border border-danger/30 bg-danger-tint p-4">
            <p className="text-sm text-danger-text">Wastage</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-danger-text">
              {batch.wastageQuantity} {batch.batchUnitName}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
