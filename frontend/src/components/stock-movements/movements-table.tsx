import type { JSX } from "react";

import { MovementActionsMenu } from "@/components/stock-movements/movement-actions-menu";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockMovementDescription } from "@/lib/inventory/stock-movement-display";
import type { StockMovement } from "@/types/stock-movements";

export type MovementsListProps = {
  canReverse: boolean;
  movements: StockMovement[];
  onReverse: (movement: StockMovement) => void;
  onView: (movement: StockMovement) => void;
};

export function formatMovementDateTime(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

/** Day and time without the seconds, for the phone cards. */
export function formatMovementDay(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

export function formatMovementQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function rowClassName(movement: StockMovement): string | undefined {
  if (movement.movementType === "reversal" || movement.isReversal) return "bg-warning-tint/50";
  if (movement.movementType === "transfer") return "bg-info-tint/40";
  if (movement.movementDirection === "in") return "bg-money-tint/40";
  if (movement.movementDirection === "out") return undefined;
  return undefined;
}

function locationName(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Unknown location";
}

function TransferDetails({ movement }: { movement: StockMovement }): JSX.Element | null {
  if (movement.movementType !== "transfer") {
    return null;
  }

  return (
    <div className="mt-2 min-w-44 rounded-lg border border-info/30 bg-info-tint/70 px-2 py-1 text-xs text-info-text">
      <p>From: {locationName(movement.fromStockLocationName)}</p>
      <p>To: {locationName(movement.toStockLocationName)}</p>
      <p>
        {formatMovementQuantity(movement.quantity)} {movement.unitSymbol}
      </p>
    </div>
  );
}

/**
 * Fourteen columns became eight.
 *
 * This table was the last thing in the module still overflowing sideways -- the
 * Description column was cut off by the viewport, so the ledger's "why" was the
 * one thing you could not read. The same treatment the item list got: keep what
 * you scan and compare down a column, move the rest into the drawer that was
 * already there.
 *
 * Every removed column is already in MovementDetailsDrawer -- Branch, Direction,
 * Before, the unit-cost and valuation detail, the Journal link, Created by, and
 * the source-module line -- so nothing became unreachable. That check is the
 * point: cutting the item list to eight columns once left Reorder level with no
 * home on the page defined by it.
 *
 * Two pairs merged rather than dropped, because splitting them cost a column
 * and bought nothing: quantity now carries its unit, and Before/After is one
 * "Stock" cell reading `13 -> 193`, which is the ledger's actual subject.
 */
export function MovementsTable({
  canReverse,
  movements,
  onReverse,
  onView,
}: MovementsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          // The row opens the drawer. The tinting stays: it is how a reversal
          // is spotted while scanning, and it survives the added cursor.
          <TableRow
            className={`cursor-pointer ${rowClassName(movement) ?? ""}`}
            key={movement.id}
            onClick={() => onView(movement)}
          >
            <TableCell className="tabular-nums">
              {formatMovementDateTime(movement.createdAt)}
            </TableCell>
            {/* Name only. The line under it used to be the first eight
                characters of inventoryItemId, which sits exactly where an item
                code goes and reads like one -- `5279d113` is entirely plausible
                as a SKU. StockMovement carries no itemCode, so there was
                nothing true to put there; the full id is in the drawer as
                "Movement ID" for anyone who needs to trace a row. */}
            <TableCell className="font-medium">
              {/* Also a button, so the keyboard has a focusable target for the
                  same action the row click performs. */}
              <button
                className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(movement);
                }}
                type="button"
              >
                {movement.itemName}
              </button>
            </TableCell>
            <TableCell>
              <MovementTypeBadge type={movement.movementType} />
              <TransferDetails movement={movement} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatMovementQuantity(movement.quantity)}
              <span className="ml-1 text-foreground-muted">{movement.unitSymbol}</span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-foreground-muted">
              {formatMovementQuantity(movement.beforeQuantity)}
              <span className="mx-1">&rarr;</span>
              <span className="font-medium text-foreground">
                {formatMovementQuantity(movement.afterQuantity)}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {movement.totalCost > 0 ? formatMoney(movement.totalCost) : "-"}
            </TableCell>
            <TableCell className="whitespace-normal max-w-72">
              <p className="truncate font-medium text-foreground">
                {stockMovementDescription(movement)}
              </p>
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <MovementActionsMenu
                canReverse={canReverse}
                movement={movement}
                onReverse={onReverse}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
