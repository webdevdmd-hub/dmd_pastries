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

function getLineName(line: Line): string {
  if ("lineType" in line && line.lineType === "account") {
    return line.description ?? line.itemNameSnapshot;
  }

  return line.itemNameSnapshot;
}

function getLineType(line: Line): string {
  if ("lineType" in line && line.lineType === "account") return "account";

  return line.itemType;
}

function getUnitLabel(line: Line): string {
  if ("lineType" in line && line.lineType === "account") return "-";

  return line.unitSymbol || line.unitName;
}

export function PurchasingItemLines({
  lines,
  title = "Item lines",
}: {
  lines: Line[];
  title?: string;
}): JSX.Element {
  return (
    <Card className="bg-card/85">
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
                  {getLineName(line)}
                </TableCell>
                <TableCell className="capitalize">{getLineType(line)}</TableCell>
                <TableCell>{getQuantity(line)}</TableCell>
                <TableCell>{getUnitLabel(line)}</TableCell>
                <TableCell>{formatLineTotal(line)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
