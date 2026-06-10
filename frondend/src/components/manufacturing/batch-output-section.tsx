import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import type { ProductionOutput } from "@/types/manufacturing";

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function outputMeta(output: ProductionOutput): string | null {
  const label = output.productVariantName ?? output.productName;
  return label ?? null;
}

export function BatchOutputSection({ outputs }: { outputs: ProductionOutput[] }): JSX.Element {
  const totalQuantity = outputs.reduce((total, output) => total + output.quantityProduced, 0);
  const totalCost = outputs.reduce((total, output) => total + output.totalCost, 0);

  return (
    <section className="rounded-2xl bg-black p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-neutral-300">
            Finished Output
          </h2>
          <p className="mt-6 font-mono text-5xl font-semibold">{totalQuantity}</p>
          <p className="mt-2 text-neutral-300">
            {outputs[0] ? outputMeta(outputs[0]) : "No output recorded yet"}
          </p>
        </div>
      </div>
      <div className="mt-6 border-t border-white/20 pt-5">
        <p className="font-mono text-2xl font-semibold">{formatMoney(totalCost)}</p>
        <p className="text-sm text-neutral-400">Estimated total value</p>
      </div>
      {outputs.length > 0 ? (
        <div className="mt-6 space-y-3">
          {outputs.map((output) => (
            <div className="rounded-xl border border-white/15 p-4" key={output.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {output.quantityProduced} {output.unitName}
                  </p>
                  <p className="text-sm text-neutral-400">{formatDate(output.createdAt)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <StockMovementLink id={output.stockMovementId} />
                  <AccountingJournalLink id={output.accountingJournalEntryId} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
