import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InventoryAccountingReconciliationRow,
  InventoryAccountingUnassignedLine,
} from "@/types/inventory-reports";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayText(value: string, fallback = "-"): string {
  return value.trim() !== "" ? value : fallback;
}

function statusBadge(row: InventoryAccountingReconciliationRow): JSX.Element {
  if (row.possibleReasonKey === "pending_bill_posting") {
    return (
      <Badge className="whitespace-nowrap border-warning/30 bg-warning-tint text-warning-text">
        Pending bill posting
      </Badge>
    );
  }

  if (row.status === "matched") {
    return (
      <Badge className="whitespace-nowrap border-money/30 bg-money-tint text-money-text">
        Matched
      </Badge>
    );
  }

  return (
    <Badge className="whitespace-nowrap border-danger/30 bg-danger-tint text-danger-text">
      Mismatch
    </Badge>
  );
}

export function InventoryAccountingReconciliationTable({
  rows,
}: {
  rows: InventoryAccountingReconciliationRow[];
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Eleven columns scroll sideways inside the card. Headers, names
                and figures never wrap; only the reason text does, so a row
                stays one line tall instead of five. */}
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="whitespace-nowrap">Item</TableHead>
            <TableHead className="whitespace-nowrap">Branch</TableHead>
            <TableHead className="whitespace-nowrap">Stock location</TableHead>
            <TableHead className="whitespace-nowrap text-right">Operational qty</TableHead>
            <TableHead className="whitespace-nowrap text-right">Operational value</TableHead>
            <TableHead className="whitespace-nowrap text-right">Stock ledger</TableHead>
            <TableHead className="whitespace-nowrap text-right">Accounting value</TableHead>
            <TableHead className="whitespace-nowrap text-right">Difference</TableHead>
            <TableHead className="whitespace-nowrap">Last transaction</TableHead>
            <TableHead className="whitespace-nowrap">Possible reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.inventoryItemId}-${row.stockLocationId ?? "unassigned"}`}>
              <TableCell>{statusBadge(row)}</TableCell>
              <TableCell>
                <div className="min-w-48">
                  <p className="font-semibold text-brand-espresso">{row.itemName || "-"}</p>
                  <p className="text-xs text-brand-mocha">{formatLabel(row.itemType) || "-"}</p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.branchName || "-"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {row.stockLocationName || "Unassigned"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatNumber(row.operationalQuantity)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(row.operationalInventoryValue)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(row.inventoryLedgerValue)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(row.accountingInventoryValue)}
              </TableCell>
              <TableCell
                className={
                  Math.abs(row.differenceAmount) > 0.01
                    ? "whitespace-nowrap text-right font-semibold tabular-nums text-danger-text"
                    : "whitespace-nowrap text-right tabular-nums text-muted-foreground"
                }
              >
                {formatMoney(row.differenceAmount)}
              </TableCell>
              <TableCell>
                <div className="min-w-44">
                  <p className="font-medium">{formatLabel(row.lastTransactionType) || "-"}</p>
                  <p className="text-xs text-brand-mocha">
                    {row.lastTransactionReference || row.lastTransactionId || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(row.lastTransactionAt)}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <p className="min-w-64 text-sm text-muted-foreground">
                  {row.possibleReason || "-"}
                </p>
                {row.possibleReasonKey === "pending_bill_posting" ? (
                  <p className="mt-1 text-xs text-brand-mocha">
                    Pending value: {formatMoney(row.pendingAccountingValue)}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function InventoryAccountingUnassignedLinesTable({
  lines,
}: {
  lines: InventoryAccountingUnassignedLine[];
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Reason</TableHead>
            <TableHead className="whitespace-nowrap">Journal</TableHead>
            <TableHead className="whitespace-nowrap">Source</TableHead>
            <TableHead className="whitespace-nowrap">Branch</TableHead>
            <TableHead className="whitespace-nowrap text-right">Debit</TableHead>
            <TableHead className="whitespace-nowrap text-right">Credit</TableHead>
            <TableHead className="whitespace-nowrap text-right">Signed amount</TableHead>
            <TableHead className="whitespace-nowrap">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => (
            <TableRow key={`${line.journalEntryId}-${String(index)}`}>
              <TableCell>
                <p className="min-w-60 text-sm text-muted-foreground">
                  {displayText(
                    line.reasonLabel,
                    "Inventory / Stock journal line is not linked to stock movements.",
                  )}
                </p>
              </TableCell>
              <TableCell>
                <div className="min-w-44">
                  <p className="font-semibold text-brand-espresso">
                    {displayText(line.journalEntryNumber, displayText(line.journalEntryId))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(line.journalEntryDate)}
                  </p>
                  <p className="text-xs text-brand-mocha">{displayText(line.referenceNumber)}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-40">
                  <p className="font-medium">
                    {displayText(formatLabel(line.sourceType), "Manual")}
                  </p>
                  <p className="text-xs text-brand-mocha">{line.sourceId ?? "-"}</p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {displayText(line.branchName, "All branches")}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(line.debitAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(line.creditAmount)}
              </TableCell>
              <TableCell
                className={
                  Math.abs(line.signedInventoryAmount) > 0.01
                    ? "whitespace-nowrap text-right font-semibold tabular-nums text-danger-text"
                    : "whitespace-nowrap text-right tabular-nums text-muted-foreground"
                }
              >
                {formatMoney(line.signedInventoryAmount)}
              </TableCell>
              <TableCell>
                <div className="min-w-64">
                  <p className="text-sm text-brand-espresso">{displayText(line.lineDescription)}</p>
                  <p className="text-xs text-muted-foreground">{displayText(line.narration)}</p>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
