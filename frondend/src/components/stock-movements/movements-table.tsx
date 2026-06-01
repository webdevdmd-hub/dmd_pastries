import type { JSX } from "react";

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

function rowClassName(movement: StockMovement): string | undefined {
  if (movement.movementType === "reversal" || movement.isReversal) return "bg-violet-50/60";
  if (movement.movementDirection === "in") return "bg-emerald-50/40";
  if (movement.movementDirection === "out") return "bg-orange-50/40";
  return undefined;
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
          <TableHead>Reference</TableHead>
          <TableHead>Reason</TableHead>
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
                <p className="font-bold">{movement.itemName}</p>
                <p className="text-xs text-brand-mocha">{movement.inventoryItemId.slice(0, 8)}</p>
              </div>
            </TableCell>
            <TableCell>{movement.branchName}</TableCell>
            <TableCell>
              <MovementTypeBadge type={movement.movementType} />
            </TableCell>
            <TableCell>
              <MovementDirectionBadge direction={movement.movementDirection} />
            </TableCell>
            <TableCell className="font-bold">{formatQuantity(movement.quantity)}</TableCell>
            <TableCell>{formatQuantity(movement.beforeQuantity)}</TableCell>
            <TableCell>{formatQuantity(movement.afterQuantity)}</TableCell>
            <TableCell>{movement.unitSymbol}</TableCell>
            <TableCell>{movement.referenceNumber ?? movement.referenceType ?? "Manual"}</TableCell>
            <TableCell>{movement.reason ?? "No reason"}</TableCell>
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
