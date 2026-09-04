import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatNumber, formatPercent } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { YieldVarianceRow } from "@/types/manufacturing-reports";

function varianceBadge(value: number): JSX.Element {
  if (value > 0) {
    return <Badge className="border-money/30 bg-money-tint text-money-text">Over produced</Badge>;
  }
  if (value < 0) {
    return (
      <Badge className="border-warning/30 bg-warning-tint text-warning-text">Under produced</Badge>
    );
  }

  return <Badge variant="outline">Exact yield</Badge>;
}

const columns: ReportColumn<YieldVarianceRow>[] = [
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
    cell: (row) => varianceBadge(row.varianceQuantity),
    header: "Indicator",
    key: "indicator",
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
    cell: (row) => <span className="tabular-nums">{formatNumber(row.varianceQuantity)}</span>,
    header: "Variance",
    key: "variance",
  },
  {
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatPercent(row.variancePercentage)}</span>
    ),
    header: "Variance %",
    key: "variance-pct",
  },
];

export function YieldVarianceTable({ rows }: { rows: YieldVarianceRow[] }): JSX.Element {
  return <ReportDataTable columns={columns} rowKey={(row) => row.batchNumber} rows={rows} />;
}
