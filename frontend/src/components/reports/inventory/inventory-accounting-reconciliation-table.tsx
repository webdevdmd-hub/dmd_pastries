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
      <Badge className="border-amber-200 bg-amber-50 text-amber-800">Pending Bill Posting</Badge>
    );
  }

  if (row.status === "matched") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Matched</Badge>;
  }

  return <Badge className="border-red-200 bg-red-50 text-red-800">Mismatch</Badge>;
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
            <TableHead>Status</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Stock location</TableHead>
            <TableHead>Operational qty</TableHead>
            <TableHead>Operational value</TableHead>
            <TableHead>Stock ledger</TableHead>
            <TableHead>Accounting value</TableHead>
            <TableHead>Difference</TableHead>
            <TableHead>Last transaction</TableHead>
            <TableHead>Possible reason</TableHead>
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
              <TableCell>{row.branchName || "-"}</TableCell>
              <TableCell>{row.stockLocationName || "Unassigned"}</TableCell>
              <TableCell>{formatNumber(row.operationalQuantity)}</TableCell>
              <TableCell>{formatMoney(row.operationalInventoryValue)}</TableCell>
              <TableCell>{formatMoney(row.inventoryLedgerValue)}</TableCell>
              <TableCell>{formatMoney(row.accountingInventoryValue)}</TableCell>
              <TableCell
                className={
                  Math.abs(row.differenceAmount) > 0.01
                    ? "font-semibold text-red-700"
                    : "text-muted-foreground"
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
            <TableHead>Reason</TableHead>
            <TableHead>Journal</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Debit</TableHead>
            <TableHead>Credit</TableHead>
            <TableHead>Signed amount</TableHead>
            <TableHead>Description</TableHead>
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
              <TableCell>{displayText(line.branchName, "All branches")}</TableCell>
              <TableCell>{formatMoney(line.debitAmount)}</TableCell>
              <TableCell>{formatMoney(line.creditAmount)}</TableCell>
              <TableCell
                className={
                  Math.abs(line.signedInventoryAmount) > 0.01
                    ? "font-semibold text-red-700"
                    : "text-muted-foreground"
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
