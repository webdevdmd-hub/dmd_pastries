import type { JSX } from "react";

import { AccountingJournalLink } from "@/components/shared/accounting-reference-links";
import { MovementActionsMenu } from "@/components/stock-movements/movement-actions-menu";
import { MovementDirectionBadge } from "@/components/stock-movements/movement-direction-badge";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  sourceModuleLabel,
  sourceReferenceLabel,
  stockMovementDescription,
} from "@/lib/inventory/stock-movement-display";
import type { StockMovement } from "@/types/stock-movements";

type MovementsTableProps = {
  canReverse: boolean;
  movements: StockMovement[];
  onReverse: (movement: StockMovement) => void;
  onView: (movement: StockMovement) => void;
};

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleString("en-AE") : "Not recorded";
}

function formatQuantity(value: number): string {
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
        {formatQuantity(movement.quantity)} {movement.unitSymbol}
      </p>
    </div>
  );
}

export function MovementsTable({
  canReverse,
  movements,
  onReverse,
  onView,
}: MovementsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Journal</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          <TableRow className={rowClassName(movement)} key={movement.id}>
            <TableCell>{formatDate(movement.createdAt)}</TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{movement.itemName}</p>
                <p className="text-xs text-foreground-muted">
                  {movement.inventoryItemId.slice(0, 8)}
                </p>
              </div>
            </TableCell>
            <TableCell>{movement.branchName}</TableCell>
            <TableCell>
              <MovementTypeBadge type={movement.movementType} />
              <TransferDetails movement={movement} />
            </TableCell>
            <TableCell>
              <MovementDirectionBadge direction={movement.movementDirection} />
            </TableCell>
            <TableCell className="font-medium">{formatQuantity(movement.quantity)}</TableCell>
            <TableCell>{formatQuantity(movement.beforeQuantity)}</TableCell>
            <TableCell>{formatQuantity(movement.afterQuantity)}</TableCell>
            <TableCell>{movement.unitSymbol}</TableCell>
            <TableCell>
              {movement.totalCost > 0 ? (
                <div>
                  <p className="font-semibold">{formatMoney(movement.totalCost)}</p>
                  <p className="text-xs text-foreground-muted">
                    Unit {formatMoney(movement.unitCostSnapshot)}
                    {movement.valuationMethod ? ` / ${movement.valuationMethod}` : ""}
                  </p>
                </div>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>
              <AccountingJournalLink id={movement.accountingJournalEntryId} />
            </TableCell>
            <TableCell className="min-w-72">
              <p className="font-medium text-foreground">{stockMovementDescription(movement)}</p>
              <p className="text-xs text-foreground-muted">
                {sourceModuleLabel(movement)} - {sourceReferenceLabel(movement)}
              </p>
            </TableCell>
            <TableCell>{movement.createdByUserName}</TableCell>
            <TableCell className="text-right">
              <MovementActionsMenu
                canReverse={canReverse}
                movement={movement}
                onReverse={onReverse}
                onView={onView}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
