import type { JSX, ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import type { PurchaseInvoiceItem } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

function lineName(line: PurchaseInvoiceItem): string {
  if (line.lineType === "account") {
    return line.description ?? line.itemNameSnapshot;
  }
  return line.itemNameSnapshot;
}

function lineTypeLabel(line: PurchaseInvoiceItem): string {
  if (line.lineType === "account") return "Account";
  return line.itemType;
}

function lineSecondaryDetail(line: PurchaseInvoiceItem): ReactNode {
  if (line.lineType === "account") {
    if (!line.accountCode && !line.accountName) return null;
    return (
      <span className="font-mono text-[0.7rem] text-workspace-muted">
        {[line.accountCode, line.accountName].filter(Boolean).join(" · ")}
      </span>
    );
  }

  const parts: string[] = [];
  if (line.batchNumber) parts.push(`Batch ${line.batchNumber}`);
  if (line.expiryDate) parts.push(`Exp ${formatDate(line.expiryDate)}`);
  if (parts.length === 0) return null;

  return <span className="text-[0.7rem] text-workspace-muted">{parts.join(" · ")}</span>;
}

export function PurchaseInvoiceItemLines({ items }: { items: PurchaseInvoiceItem[] }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[880px]">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit cost</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Tax</TableHead>
            <TableHead className="text-right">Line total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((line) => {
            const secondary = lineSecondaryDetail(line);
            const showFulfillment = line.canReceive && line.lineType !== "account";

            return (
              <TableRow key={line.id}>
                <TableCell className="max-w-xs">
                  <p className="truncate font-semibold text-brand-espresso">{lineName(line)}</p>
                  {secondary ? <p className="mt-0.5 truncate">{secondary}</p> : null}
                </TableCell>
                <TableCell className="capitalize text-workspace-muted">
                  {lineTypeLabel(line)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="text-brand-espresso">
                    {line.quantity} {line.unitSymbol || line.unitName}
                  </span>
                  {showFulfillment ? (
                    <span className="block text-[0.7rem] text-workspace-muted">
                      Received {line.quantityReceived} &middot; Remaining {line.quantityRemaining}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums text-brand-espresso">
                  {formatCurrency(line.unitCost)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    line.discountAmount > 0 ? "text-red-700" : "text-workspace-muted",
                  )}
                >
                  {line.discountAmount > 0 ? `-${formatCurrency(line.discountAmount)}` : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-brand-espresso">
                  {formatCurrency(line.taxAmount)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-brand-espresso">
                  {formatCurrency(line.lineTotal)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
