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

/**
 * What a line can say about quantity.
 *
 * `ordered` lines know both halves, so the table shows Ordered, Received and
 * Outstanding side by side. A single "Qty" column used to collapse all three:
 * on a partially received purchase order it showed the ordered figure and
 * silently dropped what had actually arrived, which is the one number a buyer
 * opens this page to check.
 */
type Quantities =
  | { kind: "ordered"; ordered: number; received: number; outstanding: number }
  | { kind: "received"; received: number }
  | { kind: "none" };

const currency = new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" });
const quantity = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 });

function isAccountLine(line: Line): boolean {
  return "lineType" in line && line.lineType === "account";
}

function getQuantities(line: Line): Quantities {
  // Account rows buy a service or an expense, never stock, so they have no
  // received half to report.
  if (isAccountLine(line)) return { kind: "none" };

  if ("quantityOrdered" in line) {
    return {
      kind: "ordered",
      ordered: line.quantityOrdered,
      outstanding: Math.max(line.quantityOrdered - line.quantityReceived, 0),
      received: line.quantityReceived,
    };
  }

  if ("quantity" in line) {
    return {
      kind: "ordered",
      ordered: line.quantity,
      // The backend computes remaining for bill lines; bill-only receipts make
      // it diverge from a naive subtraction, so take its answer.
      outstanding: Math.max(line.quantityRemaining, 0),
      received: line.quantityReceived,
    };
  }

  return { kind: "received", received: line.quantityReceived };
}

function getLineTotal(line: Line): number | null {
  return "lineTotal" in line ? line.lineTotal : null;
}

function formatLineTotal(line: Line): string {
  const total = getLineTotal(line);
  return total === null ? "Stock receipt" : currency.format(total);
}

function getLineName(line: Line): string {
  if (isAccountLine(line) && "description" in line) {
    return line.description ?? line.itemNameSnapshot;
  }

  return line.itemNameSnapshot;
}

function getLineType(line: Line): string {
  if (isAccountLine(line)) return "account";

  return line.itemType;
}

function getUnitLabel(line: Line): string {
  if (isAccountLine(line)) return "-";

  return line.unitSymbol || line.unitName;
}

/** A quantity is meaningless without its unit: 5 kg and 5 pieces are not 5. */
function withUnit(value: number, line: Line): string {
  const unit = getUnitLabel(line);
  return unit === "-" ? quantity.format(value) : `${quantity.format(value)} ${unit}`;
}

export function PurchasingItemLines({
  lines,
  title = "Item lines",
}: {
  lines: Line[];
  title?: string;
}): JSX.Element {
  const quantitiesByLine = lines.map(getQuantities);
  const tracksReceiving = quantitiesByLine.some((entry) => entry.kind === "ordered");
  const completeLines = quantitiesByLine.filter(
    (entry) => entry.kind === "ordered" && entry.outstanding === 0,
  ).length;
  const receivableLines = quantitiesByLine.filter((entry) => entry.kind === "ordered").length;

  return (
    <Card className="bg-card/85">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {tracksReceiving ? (
          <span className="text-meta tabular-nums text-foreground-muted">
            {completeLines} of {receivableLines} goods lines complete
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unit</TableHead>
              {tracksReceiving ? (
                <>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </>
              ) : (
                <TableHead className="text-right">Received</TableHead>
              )}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, index) => {
              const amounts = quantitiesByLine[index] ?? { kind: "none" as const };

              return (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{getLineName(line)}</TableCell>
                  <TableCell className="capitalize text-foreground-muted">
                    {getLineType(line)}
                  </TableCell>
                  <TableCell className="text-foreground-muted">{getUnitLabel(line)}</TableCell>
                  {tracksReceiving ? (
                    amounts.kind === "ordered" ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {withUnit(amounts.ordered, line)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {amounts.received === 0 ? (
                            <span className="text-foreground-muted">None yet</span>
                          ) : (
                            withUnit(amounts.received, line)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {amounts.outstanding === 0 ? (
                            <span className="text-money-text">Complete</span>
                          ) : (
                            withUnit(amounts.outstanding, line)
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right text-foreground-muted">-</TableCell>
                        <TableCell className="text-right text-foreground-muted">
                          Not stocked
                        </TableCell>
                        <TableCell className="text-right text-foreground-muted">-</TableCell>
                      </>
                    )
                  ) : (
                    <TableCell className="text-right tabular-nums">
                      {amounts.kind === "received" ? withUnit(amounts.received, line) : "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{formatLineTotal(line)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
