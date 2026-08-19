import type { JSX } from "react";

import type { ExpiryBatch, InventoryItem } from "@/types/inventory";

type InventorySummaryCardsProps = {
  items: InventoryItem[];
  expiryAlerts?: ExpiryBatch[];
  /** Server-side row count. When it exceeds items.length, the page truncated. */
  total?: number;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

type Stat = {
  label: string;
  value: string;
  /** Warning tint only when the number is one a manager has to act on. */
  attention?: boolean;
};

/**
 * Four figures in one strip rather than four cards.
 *
 * The card treatment cost ~560px above the table for four numbers -- on a
 * screen whose job is an at-a-glance read of stock, the chrome outweighed the
 * content. Same four values, same sources, one row.
 *
 * Colour follows DESIGN.md §3.3: warning is the role for "low stock /
 * expiring", so those two go amber only when non-zero, because a zero is not
 * a thing to act on. Total stock value stays neutral -- money green is
 * reserved for money-committing actions and reconciled states, not for every
 * figure that happens to be currency.
 */
export function InventorySummaryCards({
  items,
  expiryAlerts = [],
  total,
}: InventorySummaryCardsProps): JSX.Element {
  // The list endpoint caps at 100 rows. "Total items" comes from the server's
  // own count, so it is always exact; the two figures derived by walking the
  // rows are floors once the page truncates, and they say so with a "+" --
  // a stock value quietly computed over part of the branch is exactly the
  // silently-wrong number this strip exists to prevent.
  const serverTotal = total ?? items.length;
  const truncated = serverTotal > items.length;
  const floor = (value: string): string => (truncated ? `${value}+` : value);
  const lowStockCount = items.filter((item) => item.lowStock).length;
  const expiringCount = expiryAlerts.length;
  const totalStockValue = items.reduce((sum, item) => sum + item.inventoryValue, 0);

  const stats: Stat[] = [
    { label: "Total items", value: String(serverTotal) },
    { label: "Low stock", value: floor(String(lowStockCount)), attention: lowStockCount > 0 },
    { label: "Expiring soon", value: String(expiringCount), attention: expiringCount > 0 },
    {
      label: truncated ? "Stock value (first 100 items)" : "Total stock value",
      value: floor(formatMoney(totalStockValue)),
    },
  ];

  return (
    // Hairlines come from a 1px grid gap showing the border colour through
    // from behind, not from per-cell borders. Per-cell `border-r` with a
    // `last:border-r-0` reset only clears the final cell, so at the two-column
    // mobile breakpoint cell 2 painted a rule down the container's right edge
    // and cells 3-4 painted one along its bottom. The gap approach cannot draw
    // an outer edge by construction, at either breakpoint.
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded bg-border md:grid-cols-4">
      {stats.map((stat) => (
        <div className="flex flex-col justify-center gap-0.5 bg-muted px-4 py-3" key={stat.label}>
          <dt className="text-meta text-foreground-muted">{stat.label}</dt>
          <dd
            className={
              stat.attention
                ? "text-title font-medium tabular-nums text-warning-text"
                : "text-title font-medium tabular-nums text-foreground"
            }
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
