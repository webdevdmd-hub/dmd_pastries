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
      <span className="font-mono text-meta text-workspace-muted">
        {[line.accountCode, line.accountName].filter(Boolean).join(" · ")}
      </span>
    );
  }

  const parts: string[] = [];
  if (line.batchNumber) parts.push(`Batch ${line.batchNumber}`);
  if (line.expiryDate) parts.push(`Exp ${formatDate(line.expiryDate)}`);
  if (parts.length === 0) return null;

  return <span className="text-meta text-workspace-muted">{parts.join(" · ")}</span>;
}

export type BillTotals = {
  balance: number;
  billDiscount: number;
  legacyCharges: number;
  lineDiscounts: number;
  paid: number;
  subtotal: number;
  tax: number;
  total: number;
};

/**
 * The money a bill adds up to, under the table it adds up.
 *
 * Deliberately NOT a <tfoot>. This table carries min-w-[880px], so inside a
 * 663px card the last column sits 219px off-screen -- and the last column is
 * where a tfoot puts every figure, which would hide the balance due behind a
 * sideways scroll. These totals belong to the bill, not to the table's column
 * grid, so they live outside the scroller and are always readable.
 *
 * It used to live in a 547px card beside the table, which stated a Balance due /
 * Total / Paid trio and then, ten rows lower, the ledger those three are
 * computed from. On a bill with no discount and no tax that card printed
 * AED 4,500.00 five times and AED 0.00 five times. Rows that are zero and
 * optional (both discounts, legacy charges) no longer render at all.
 */
function BillTotalsFooter({ totals }: { totals: BillTotals }): JSX.Element {
  const rows: { emphasis?: boolean; label: string; tone?: string; value: string }[] = [];

  // Subtotal only says something when something adjusts it. On a bill with no
  // tax and no discount it is the Total again, three rows above the Total.
  if (totals.subtotal !== totals.total) {
    rows.push({ label: "Subtotal", value: formatCurrency(totals.subtotal) });
  }

  if (totals.lineDiscounts > 0) {
    rows.push({
      label: "Line discounts",
      tone: "text-danger-text",
      value: `-${formatCurrency(totals.lineDiscounts)}`,
    });
  }
  if (totals.billDiscount > 0) {
    rows.push({
      label: "Bill discount",
      tone: "text-danger-text",
      value: `-${formatCurrency(totals.billDiscount)}`,
    });
  }
  if (totals.tax > 0) {
    rows.push({ label: "Tax", value: formatCurrency(totals.tax) });
  }
  if (totals.legacyCharges > 0) {
    rows.push({ label: "Legacy charges", value: formatCurrency(totals.legacyCharges) });
  }
  rows.push(
    { emphasis: true, label: "Total", value: formatCurrency(totals.total) },
    { label: "Paid", tone: "text-money-text", value: formatCurrency(totals.paid) },
    { emphasis: true, label: "Balance due", value: formatCurrency(totals.balance) },
  );

  return (
    <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-workspace-border px-5 py-4 text-cell">
      {rows.map((row) => (
        <div className="flex items-baseline justify-between gap-6" key={row.label}>
          <dt
            className={row.emphasis ? "font-semibold text-brand-espresso" : "text-workspace-muted"}
          >
            {row.label}
          </dt>
          <dd
            className={cn(
              "tabular-nums text-brand-espresso",
              row.emphasis && "font-semibold",
              row.tone,
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PurchaseInvoiceItemLines({
  items,
  totals,
}: {
  items: PurchaseInvoiceItem[];
  /** Optional so any caller without a money summary renders exactly as before. */
  totals?: BillTotals;
}): JSX.Element {
  return (
    <>
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
                  <TableCell className="whitespace-normal max-w-xs">
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
                      <span className="block text-meta text-workspace-muted">
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
                      line.discountAmount > 0 ? "text-danger-text" : "text-workspace-muted",
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
      {totals ? <BillTotalsFooter totals={totals} /> : null}
    </>
  );
}
