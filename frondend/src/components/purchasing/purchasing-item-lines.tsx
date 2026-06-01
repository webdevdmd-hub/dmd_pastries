import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PurchaseInvoiceItem,
  PurchaseOrderItem,
  PurchaseReceiptItem,
} from "@/types/purchasing";

type Line = PurchaseOrderItem | PurchaseInvoiceItem | PurchaseReceiptItem;

function getQuantity(line: Line): number {
  if ("quantityOrdered" in line) return line.quantityOrdered;
  if ("quantity" in line) return line.quantity;
  return line.quantityReceived;
}

function getLineTotal(line: Line): number | null {
  return "lineTotal" in line ? line.lineTotal : null;
}

function formatLineTotal(line: Line): string {
  const total = getLineTotal(line);
  return total === null ? "Stock receipt" : `AED ${total.toFixed(2)}`;
}

export function PurchasingItemLines({
  lines,
  title = "Item lines",
}: {
  lines: Line[];
  title?: string;
}): JSX.Element {
  return (
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-semibold text-brand-espresso">
                  {line.itemNameSnapshot}
                </TableCell>
                <TableCell className="capitalize">{line.itemType}</TableCell>
                <TableCell>{getQuantity(line)}</TableCell>
                <TableCell>{line.unitSymbol || line.unitName}</TableCell>
                <TableCell>{formatLineTotal(line)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
