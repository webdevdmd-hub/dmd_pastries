"use client";

import type { JSX } from "react";

import type { SupplierStats } from "@/types/supplier";

type SupplierStatsCardsProps = {
  stats: SupplierStats | undefined;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

/**
 * The figures that matter before you open a tab.
 *
 * Two things were wrong beyond the styling. "Purchase Amount" sat beside
 * "Purchase Orders" and read as the value of those orders, but the endpoint's
 * `total_purchase_amount` is BILL-derived: for a supplier with 3 POs worth
 * AED 4,703 and one bill worth AED 4,500, it showed 4,500 next to "3", so
 * AED 203 of committed spend read as absent. It is labelled "Billed" with its
 * own count now, so the basis is on the card rather than inferred.
 *
 * A true "Ordered" total needs `total_po_amount` from the stats endpoint; the
 * figure is not computable here without pulling every order into a page that
 * otherwise loads its purchasing queries lazily. Naming the basis is the honest
 * half of the fix that costs nothing.
 *
 * `last_purchase_date` is PO-derived, so it is "Last order", not "Last purchase".
 */
export function SupplierStatsCards({ stats }: SupplierStatsCardsProps): JSX.Element {
  const orderCount = stats?.totalPurchaseOrders ?? 0;
  const billCount = stats?.totalBills ?? 0;

  const cards = [
    {
      label: "Purchase orders",
      value: String(orderCount),
      hint: orderCount === 1 ? "1 raised" : `${String(orderCount)} raised`,
    },
    {
      label: "Billed",
      value: formatCurrency(stats?.totalPurchaseAmount ?? 0),
      hint: billCount === 1 ? "across 1 bill" : `across ${String(billCount)} bills`,
    },
    {
      label: "Paid",
      value: formatCurrency(stats?.totalPaidAmount ?? 0),
      hint: "recorded against bills",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats?.outstandingBalance ?? 0),
      hint: "still owed",
    },
    {
      label: "Last order",
      value: formatDate(stats?.lastPurchaseDate ?? null),
      hint: "most recent purchase order",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div className="rounded-xl bg-muted p-4" key={card.label}>
          <p className="text-meta text-foreground-muted">{card.label}</p>
          <p className="mt-1.5 text-title tabular-nums">{card.value}</p>
          <p className="mt-0.5 text-meta tabular-nums text-foreground-muted">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
