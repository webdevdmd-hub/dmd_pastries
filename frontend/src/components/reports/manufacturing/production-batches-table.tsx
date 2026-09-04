import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import {
  formatDate,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { ProductionBatchReportRow } from "@/types/manufacturing-reports";

function statusBadge(status: string): JSX.Element {
  if (status === "completed") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">Completed</Badge>;
  }
  if (status === "cancelled") {
    return <Badge className="border-danger/30 bg-danger-tint text-danger-text">Cancelled</Badge>;
  }
  if (status === "in_progress" || status === "partially_completed") {
    return (
      <Badge className="border-warning/30 bg-warning-tint text-warning-text">
        {status.replaceAll("_", " ")}
      </Badge>
    );
  }

  return <Badge variant="outline">{status || "Draft"}</Badge>;
}

const columns: ReportColumn<ProductionBatchReportRow>[] = [
  {
    cell: (row) => row.batchNumber || "-",
    header: "Batch",
    key: "batch",
    primary: true,
  },
  {
    cell: (row) => `${row.productName || "-"} - ${row.branchName || "-"}`,
    header: "Product",
    key: "product",
    secondary: true,
  },
  {
    cell: (row) => row.recipeName || "-",
    header: "Recipe",
    key: "recipe",
  },
  {
    cell: (row) => statusBadge(row.status),
    header: "Status",
    key: "status",
    unlabelledOnCard: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.plannedQuantity)}</span>,
    header: "Planned",
    key: "planned",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.producedQuantity)}</span>,
    header: "Produced",
    key: "produced",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.yieldVariance)}</span>,
    header: "Variance",
    key: "variance",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">
        {formatPercent(row.yieldEfficiencyPercentage)}
      </span>
    ),
    header: "Efficiency",
    key: "efficiency",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.startTime)}</span>,
    header: "Start",
    key: "start",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.endTime)}</span>,
    header: "End",
    key: "end",
  },
];

export function ProductionBatchesTable({
  rows,
}: {
  rows: ProductionBatchReportRow[];
}): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.batchId} rows={rows} />;
}
