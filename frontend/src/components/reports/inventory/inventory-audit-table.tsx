import type { JSX } from "react";

import { AuditStatusBadge } from "@/components/reports/inventory/audit-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryAuditRow } from "@/types/inventory-reports";

export function InventoryAuditTable({ rows }: { rows: InventoryAuditRow[] }): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Current Qty</TableHead>
          <TableHead>Ledger Qty</TableHead>
          <TableHead>Difference</TableHead>
          <TableHead>Audit Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.inventoryItemId}>
            <TableCell>
              <div className="font-semibold">{row.itemName || "-"}</div>
              {!row.isBalanced ? (
                <div className="text-xs text-danger-text">
                  Investigate stock movements or perform correction adjustment.
                </div>
              ) : null}
            </TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.currentQuantity}</TableCell>
            <TableCell>{row.calculatedQuantityFromMovements}</TableCell>
            <TableCell>{row.difference}</TableCell>
            <TableCell>
              <AuditStatusBadge isBalanced={row.isBalanced} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
