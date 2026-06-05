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
          <TableHead>Reference</TableHead>
          <TableHead>Reason</TableHead>
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
            <TableCell>{movement.referenceType ?? "Manual"}</TableCell>
            <TableCell>{movement.reason ?? "No reason"}</TableCell>
            <TableCell>{movement.createdByUserName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
