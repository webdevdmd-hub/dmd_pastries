import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { Badge } from "@/components/ui/badge";
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

/** A difference worth acting on, as opposed to rounding noise. */
function isMaterial(amount: number): boolean {
  return Math.abs(amount) > 0.01;
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

const reconciliationColumns: ReportColumn<InventoryAccountingReconciliationRow>[] = [
  {
    cell: (row) => row.itemName || "-",
    header: "Item",
    key: "item",
    primary: true,
  },
  {
    cell: (row) => `${formatLabel(row.itemType) || "-"} - ${row.branchName || "-"}`,
    header: "Branch",
    key: "branch",
    secondary: true,
  },
  { cell: (row) => statusBadge(row), header: "Status", key: "status", unlabelledOnCard: true },
  {
    cell: (row) => row.stockLocationName || "Unassigned",
    header: "Stock location",
    key: "location",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.operationalQuantity)}</span>,
    header: "Operational qty",
    key: "operational-qty",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">{formatMoney(row.operationalInventoryValue)}</span>
    ),
    header: "Operational value",
    key: "operational-value",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatMoney(row.inventoryLedgerValue)}</span>,
    header: "Stock ledger",
    key: "stock-ledger",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">{formatMoney(row.accountingInventoryValue)}</span>
    ),
    header: "Accounting value",
    key: "accounting-value",
  },
  {
    align: "right",
    cell: (row) => (
      <span
        className={
          isMaterial(row.differenceAmount)
            ? "font-medium tabular-nums text-danger-text"
            : "tabular-nums text-muted-foreground"
        }
      >
        {formatMoney(row.differenceAmount)}
      </span>
    ),
    header: "Difference",
    key: "difference",
  },
  {
    align: "right",
    cell: (row) => (
      <div className="md:min-w-44">
        <p className="font-medium">{formatLabel(row.lastTransactionType) || "-"}</p>
        <p className="text-meta text-brand-mocha">
          {row.lastTransactionReference || row.lastTransactionId || "-"}
        </p>
        <p className="text-meta text-muted-foreground">{formatDateTime(row.lastTransactionAt)}</p>
      </div>
    ),
    header: "Last transaction",
    key: "last-transaction",
  },
  {
    cell: (row) => (
      <div className="md:min-w-[28rem]">
        <p className="whitespace-normal text-cell text-muted-foreground">
          {row.possibleReason || "-"}
        </p>
        {row.possibleReasonKey === "pending_bill_posting" ? (
          <p className="mt-1 text-meta text-brand-mocha">
            Pending value: {formatMoney(row.pendingAccountingValue)}
          </p>
        ) : null}
      </div>
    ),
    header: "Possible reason",
    key: "reason",
  },
];

export function InventoryAccountingReconciliationTable({
  rows,
}: {
  rows: InventoryAccountingReconciliationRow[];
}): JSX.Element {
  return (
    <ReportDataTable
      columns={reconciliationColumns}
      rowKey={(row) => `${row.inventoryItemId}-${row.stockLocationId ?? "unassigned"}`}
      rows={rows}
    />
  );
}

const unassignedColumns: ReportColumn<InventoryAccountingUnassignedLine>[] = [
  {
    cell: (line) => displayText(line.journalEntryNumber, displayText(line.journalEntryId)),
    header: "Journal",
    key: "journal",
    primary: true,
  },
  {
    cell: (line) =>
      `${formatDateTime(line.journalEntryDate)} - ${displayText(line.referenceNumber)}`,
    header: "Journal date",
    key: "journal-date",
    secondary: true,
  },
  {
    cell: (line) => (
      <p className="whitespace-normal text-cell text-muted-foreground md:min-w-60">
        {displayText(
          line.reasonLabel,
          "Inventory / Stock journal line is not linked to stock movements.",
        )}
      </p>
    ),
    header: "Reason",
    key: "reason",
  },
  {
    cell: (line) => (
      <div className="md:min-w-40">
        <p className="font-medium">{displayText(formatLabel(line.sourceType), "Manual")}</p>
        <p className="text-meta text-brand-mocha">{line.sourceId ?? "-"}</p>
      </div>
    ),
    header: "Source",
    key: "source",
  },
  {
    cell: (line) => displayText(line.branchName, "All branches"),
    header: "Branch",
    key: "branch",
  },
  {
    align: "right",
    cell: (line) => <span className="tabular-nums">{formatMoney(line.debitAmount)}</span>,
    header: "Debit",
    key: "debit",
  },
  {
    align: "right",
    cell: (line) => <span className="tabular-nums">{formatMoney(line.creditAmount)}</span>,
    header: "Credit",
    key: "credit",
  },
  {
    align: "right",
    cell: (line) => (
      <span
        className={
          isMaterial(line.signedInventoryAmount)
            ? "font-medium tabular-nums text-danger-text"
            : "tabular-nums text-muted-foreground"
        }
      >
        {formatMoney(line.signedInventoryAmount)}
      </span>
    ),
    header: "Signed amount",
    key: "signed",
  },
  {
    cell: (line) => (
      <div className="md:min-w-64">
        <p className="whitespace-normal text-cell text-brand-espresso">
          {displayText(line.lineDescription)}
        </p>
        <p className="whitespace-normal text-meta text-muted-foreground">
          {displayText(line.narration)}
        </p>
      </div>
    ),
    header: "Description",
    key: "description",
  },
];

export function InventoryAccountingUnassignedLinesTable({
  lines,
}: {
  lines: InventoryAccountingUnassignedLine[];
}): JSX.Element {
  return (
    <ReportDataTable
      columns={unassignedColumns}
      rowKey={(line, index) => `${line.journalEntryId}-${String(index)}`}
      rows={lines}
    />
  );
}
