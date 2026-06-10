import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import type { ProductionWastage } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

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

function wastageName(item: ProductionWastage): string {
  return item.componentProductName ?? item.itemName;
}

function wastageMeta(item: ProductionWastage): string {
  const parts = [
    item.componentProductType ? PRODUCT_TYPE_LABELS[item.componentProductType] : "Legacy item",
    item.componentVariantName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

export function BatchWastageSection({ wastage }: { wastage: ProductionWastage[] }): JSX.Element {
  const totalCost = wastage.reduce((total, item) => total + item.totalCost, 0);

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-red-700">
            Production Wastage
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Backend-recorded losses and stock movements for this production.
          </p>
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-red-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">Loss value</p>
        <p className="mt-2 font-mono text-2xl font-semibold text-red-700">
          {formatMoney(totalCost)}
        </p>
      </div>
      <div className="mt-5 space-y-4">
        {wastage.length === 0 ? (
          <p className="text-sm text-neutral-500">No wastage recorded yet.</p>
        ) : (
          wastage.map((item) => (
            <div className="border-l-4 border-red-600 pl-4" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-950">{wastageName(item)}</p>
                  <p className="text-xs text-neutral-500">{wastageMeta(item)}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {item.quantity} {item.unitName} / {item.wastageType}
                  </p>
                  {item.reason ? (
                    <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                      Reason: {item.reason}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-500">{formatDate(item.createdAt)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <StockMovementLink id={item.stockMovementId} />
                  <AccountingJournalLink id={item.accountingJournalEntryId} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
