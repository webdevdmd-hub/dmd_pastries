import type { JSX } from "react";

import { orderStatusBadge } from "@/components/reports/bakery-orders/upcoming-orders-table";
import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatDate, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { ProductionScheduleRow } from "@/types/bakery-orders-reports";

function productionStatusLabel(status: string): string {
  if (!status) {
    return "Unassigned";
  }

  return status.replaceAll("_", " ");
}

function productionStatusBadge(row: ProductionScheduleRow): JSX.Element {
  const variant =
    row.productionStatus === "not_linked" || !row.productionStatus ? "outline" : "secondary";

  return <Badge variant={variant}>{productionStatusLabel(row.productionStatus)}</Badge>;
}

const columns: ReportColumn<ProductionScheduleRow>[] = [
  {
    cell: (row) => row.orderNumber || "-",
    header: "Order",
    key: "order",
    primary: true,
  },
  {
    cell: (row) => `${row.productName || "-"} - ${row.branchName || "-"}`,
    header: "Product",
    key: "product",
    secondary: true,
  },
  {
    cell: (row) => orderStatusBadge(row.orderStatus),
    header: "Order status",
    key: "order-status",
    unlabelledOnCard: true,
  },
  {
    cell: (row) => productionStatusBadge(row),
    header: "Production",
    key: "production",
  },
  {
    cell: (row) => (
      <div>
        {row.assignedBatchNumber ||
          (row.hasProductionRecord ? (
            <span className="text-danger-text">Missing assignment</span>
          ) : (
            <span className="text-muted-foreground">No batch</span>
          ))}
        {row.productionBatchStatus ? (
          <div className="text-meta text-muted-foreground">
            {row.productionBatchStatus.replaceAll("_", " ")}
          </div>
        ) : null}
      </div>
    ),
    header: "Batch",
    key: "batch",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.quantity)}</span>,
    header: "Qty",
    key: "qty",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.eventDate)}</span>,
    header: "Event date",
    key: "event-date",
  },
  {
    cell: (row) => (
      <span className="block max-w-xs whitespace-normal text-cell text-muted-foreground">
        {row.productionNote || "-"}
      </span>
    ),
    header: "Note",
    key: "note",
  },
];

export function ProductionScheduleTable({ rows }: { rows: ProductionScheduleRow[] }): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row, index) => `${row.orderNumber}-${String(index)}`}
      rows={rows}
    />
  );
}
