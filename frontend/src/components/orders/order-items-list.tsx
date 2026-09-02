"use client";

import { ChevronRight } from "lucide-react";
import type { JSX } from "react";

import type { BakeryOrder, BakeryOrderItem } from "@/types/orders";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/** The one-line summary under an item's name: quantity, unit, and any spec. */
export function describeOrderItem(item: BakeryOrderItem): string {
  const parts = [`Qty ${String(item.quantity)}`, item.unitName];
  if (item.weight !== null) {
    parts.push(`${String(item.weight)} kg`);
  }
  if (item.flavor) {
    parts.push(item.flavor);
  }
  if (item.messageText) {
    parts.push(`"${item.messageText}"`);
  }
  return parts.join(" - ");
}

/**
 * The order's lines and charges. Every line is a button that opens its details
 * sheet, so the row itself stays a summary: name, spec, total.
 */
export function OrderItemsList({
  onSelectItem,
  order,
}: {
  onSelectItem: (item: BakeryOrderItem) => void;
  order: BakeryOrder;
}): JSX.Element {
  const hasCharges = order.chargeAmount > 0 || order.chargeTaxAmount > 0;

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-card/85 p-5">
      <div>
        <h2 className="text-title text-brand-espresso">Order items</h2>
        <p className="text-cell text-foreground-muted">Select an item to see its full details.</p>
      </div>
      <ul className="mt-5 overflow-hidden rounded-2xl border border-brand-cappuccino/60">
        {order.items.map((item) => (
          <li className="border-b border-brand-cappuccino/40 last:border-b-0" key={item.id}>
            <button
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 p-4 text-left transition-colors duration-fast ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onSelectItem(item)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate text-body font-medium text-brand-espresso">
                  {item.itemNameSnapshot}
                </span>
                {item.itemSource === "custom" ? (
                  <span className="block text-meta text-foreground-muted">Custom item</span>
                ) : null}
                <span className="block text-cell text-foreground-muted">
                  {describeOrderItem(item)}
                </span>
              </span>
              <span className="text-body font-medium tabular-nums text-brand-espresso">
                {formatCurrency(item.lineTotal)}
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-foreground-muted" />
            </button>
          </li>
        ))}
      </ul>
      {hasCharges ? (
        <div className="mt-5 rounded-2xl bg-muted p-4">
          <h3 className="text-body font-medium text-brand-espresso">Charges</h3>
          <div className="mt-3 grid gap-2 text-cell">
            {order.charges.map((charge) => (
              <div
                className="flex items-start justify-between gap-3"
                key={charge.id || charge.chargeName}
              >
                <div>
                  <p className="font-medium text-brand-espresso">{charge.chargeName}</p>
                  {charge.description ? (
                    <p className="text-meta text-foreground-muted">{charge.description}</p>
                  ) : null}
                </div>
                <p className="font-medium tabular-nums text-brand-espresso">
                  {formatCurrency(charge.totalAmount)}
                </p>
              </div>
            ))}
            <div className="flex justify-between border-t border-brand-cappuccino/60 pt-2">
              <span className="text-foreground-muted">Charge tax</span>
              <span className="font-medium tabular-nums text-brand-espresso">
                {formatCurrency(order.chargeTaxAmount)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
