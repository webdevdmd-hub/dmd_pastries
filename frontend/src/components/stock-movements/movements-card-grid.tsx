"use client";

import type { JSX } from "react";

import { MovementActionsMenu } from "@/components/stock-movements/movement-actions-menu";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import {
  formatMovementDay,
  formatMovementQuantity,
  type MovementsListProps,
} from "@/components/stock-movements/movements-table";
import { Card } from "@/components/ui/card";
import { stockMovementDescription } from "@/lib/inventory/stock-movement-display";

/**
 * The ledger as cards, for phones. Eight columns of numbers do not survive a
 * 375px viewport, and the one column a storekeeper actually reads on a phone
 * is the description, which is the first thing a squeezed table drops.
 */
export function MovementsCardGrid({
  canReverse,
  movements,
  onReverse,
  onView,
}: MovementsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {movements.map((movement) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={movement.id}
          onClick={() => onView(movement)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="grid min-w-0 gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(movement);
              }}
              type="button"
            >
              <span className="truncate font-medium">{movement.itemName}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <MovementTypeBadge type={movement.movementType} />
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <MovementActionsMenu
                canReverse={canReverse}
                movement={movement}
                onReverse={onReverse}
              />
            </div>
          </div>

          <p className="px-4 py-3 text-cell text-foreground-muted">
            {stockMovementDescription(movement)}
          </p>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Quantity</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatMovementQuantity(movement.quantity)}
                <span className="ml-1 text-foreground-muted">{movement.unitSymbol}</span>
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Stock</p>
              <p className="mt-1 text-cell tabular-nums text-foreground-muted">
                {formatMovementQuantity(movement.beforeQuantity)}
                <span className="mx-1">&rarr;</span>
                <span className="font-medium text-foreground">
                  {formatMovementQuantity(movement.afterQuantity)}
                </span>
              </p>
            </div>
          </div>

          <p className="border-t border-workspace-border px-4 py-2 text-meta tabular-nums text-foreground-muted">
            {formatMovementDay(movement.createdAt)} · {movement.branchName}
          </p>
        </Card>
      ))}
    </div>
  );
}
