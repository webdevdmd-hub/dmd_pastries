import type { JSX } from "react";

import { isBatchPlannedStatus } from "@/lib/manufacturing/batch-status";
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchTimeline({ batch }: { batch: ProductionBatch }): JSX.Element {
  const steps = [
    { done: true, label: "Planned" },
    { done: !isBatchPlannedStatus(batch.status), label: "Production Posted" },
    {
      done: batch.producedQuantity > 0 || batch.status === "completed",
      label: "Output Produced",
    },
    { done: batch.status === "completed", label: "Completed" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-sm font-bold text-foreground">Production Timeline</h2>
      <div className="mt-6 space-y-0">
        {steps.map((step, index) => (
          <div className="grid grid-cols-[24px_1fr] gap-4" key={step.label}>
            <div className="flex flex-col items-center">
              <span
                className={
                  step.done
                    ? "h-4 w-4 rounded-full bg-primary"
                    : "h-4 w-4 rounded-full border-2 border-border bg-card"
                }
              />
              {index < steps.length - 1 ? <span className="h-12 w-px bg-border" /> : null}
            </div>
            <div className="-mt-1 pb-6">
              <p
                className={
                  step.done
                    ? "font-semibold text-foreground"
                    : "font-semibold text-foreground-muted"
                }
              >
                {step.label}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                {step.done ? "Completed in workflow" : "Pending"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
