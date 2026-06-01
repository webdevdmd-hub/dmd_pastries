import { CircleDollarSign, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { WastageReport } from "@/types/inventory-reports";

export function WastageSummaryCard({ report }: { report: WastageReport | undefined }): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReportKpiCard
        icon={Trash2}
        label="Wastage Quantity"
        value={formatNumber(report?.totalWastageQuantity ?? 0)}
      />
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Wastage Value"
        value={formatCurrency(report?.wastageValue ?? 0)}
      />
    </div>
  );
}
