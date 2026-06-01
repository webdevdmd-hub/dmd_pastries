import { CircleDollarSign, PackageSearch } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { StockValuationRow } from "@/types/inventory-reports";

export function StockValuationSummary({ rows }: { rows: StockValuationRow[] }): JSX.Element {
  const totalValue = rows.reduce((sum, row) => sum + row.stockValue, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Total Stock Value"
        value={formatCurrency(totalValue)}
      />
      <ReportKpiCard icon={PackageSearch} label="Valued Items" value={formatNumber(rows.length)} />
    </div>
  );
}
