import type { JSX } from "react";

import { MovementTypeBadge } from "@/components/inventory/movement-type-badge";
import { AccountingJournalLink } from "@/components/shared/accounting-reference-links";
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
import type { StockMovement } from "@/types/inventory";

type StockMovementsTableProps = {
  movements: StockMovement[];
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

function locationName(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Unknown location";
}

function TransferDetails({ movement }: { movement: StockMovement }): JSX.Element | null {
  if (movement.movementType !== "transfer") {
    return null;
  }

  return (
    <div className="mt-2 min-w-44 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1 text-xs text-sky-950">
      <p>From: {locationName(movement.fromStockLocationName)}</p>
      <p>To: {locationName(movement.toStockLocationName)}</p>
      <p>
        {formatQuantity(movement.quantity)} {movement.unitSymbol}
      </p>
    </div>
  );
}

export function StockMovementsTable({ movements }: StockMovementsTableProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Before</TableHead>
          <TableHead>After</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Journal</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Created By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell>{formatDate(movement.createdAt)}</TableCell>
            <TableCell className="font-bold">{movement.itemName}</TableCell>
            <TableCell>{movement.branchName}</TableCell>
            <TableCell>
              <MovementTypeBadge type={movement.movementType} />
              <TransferDetails movement={movement} />
            </TableCell>
            <TableCell className="font-bold">{formatQuantity(movement.quantity)}</TableCell>
            <TableCell>{formatQuantity(movement.beforeQuantity)}</TableCell>
            <TableCell>{formatQuantity(movement.afterQuantity)}</TableCell>
            <TableCell>{movement.unitSymbol}</TableCell>
            <TableCell>
              {movement.totalCost > 0 ? (
                <div>
                  <p className="font-semibold">{formatMoney(movement.totalCost)}</p>
                  <p className="text-xs text-brand-mocha">
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
              <p className="font-medium text-brand-espresso">
                {stockMovementDescription(movement)}
              </p>
              <p className="text-xs text-brand-mocha">
                {sourceModuleLabel(movement)} - {sourceReferenceLabel(movement)}
              </p>
            </TableCell>
            <TableCell>{movement.createdByUserName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
