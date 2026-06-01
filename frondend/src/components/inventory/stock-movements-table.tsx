import type { JSX } from "react";

import { MovementTypeBadge } from "@/components/inventory/movement-type-badge";
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
            <TableCell>{movement.referenceType ?? "Manual"}</TableCell>
            <TableCell>{movement.reason ?? "No reason"}</TableCell>
            <TableCell>{movement.createdByUserName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
