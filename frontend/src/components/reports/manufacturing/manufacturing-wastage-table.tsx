import type { JSX } from "react";

import { type ReportColumn, ReportDataTable } from "@/components/reports/report-data-table";
import { formatDate, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Badge } from "@/components/ui/badge";
import type { ManufacturingWastageRow } from "@/types/manufacturing-reports";

function wastageBadge(type: string): JSX.Element {
  if (type === "finished_goods_wastage") {
    return (
      <Badge className="border-danger/30 bg-danger-tint text-danger-text">Finished goods</Badge>
    );
  }

  return (
    <Badge className="border-warning/30 bg-warning-tint text-warning-text">
      {type.replaceAll("_", " ") || "Wastage"}
    </Badge>
  );
}

const columns: ReportColumn<ManufacturingWastageRow>[] = [
  {
    cell: (row) => row.itemName || "-",
    header: "Item",
    key: "item",
    primary: true,
  },
  {
    cell: (row) => row.batchNumber || "-",
    header: "Batch",
    key: "batch",
    secondary: true,
  },
  {
    cell: (row) => wastageBadge(row.wastageType),
    header: "Type",
    key: "type",
    unlabelledOnCard: true,
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatNumber(row.quantity)}</span>,
    header: "Quantity",
    key: "quantity",
  },
  {
    align: "right",
    cell: (row) => row.unitSymbol || "-",
    header: "Unit",
    key: "unit",
  },
  {
    cell: (row) => <span className="block whitespace-normal md:min-w-64">{row.reason || "-"}</span>,
    header: "Reason",
    key: "reason",
  },
  {
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDate(row.createdAt)}</span>,
    header: "Created",
    key: "created",
  },
];

export function ManufacturingWastageTable({
  rows,
}: {
  rows: ManufacturingWastageRow[];
}): JSX.Element {
  return (
    <ReportDataTable
      columns={columns}
      rowKey={(row, index) => `${row.itemName}-${row.createdAt}-${String(index)}`}
      rows={rows}
    />
  );
}
