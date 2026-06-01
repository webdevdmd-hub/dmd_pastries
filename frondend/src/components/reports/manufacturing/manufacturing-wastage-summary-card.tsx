import { CircleDollarSign, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { ManufacturingWastageReport } from "@/types/manufacturing-reports";

export function ManufacturingWastageSummaryCard({
  report,
}: {
  report: ManufacturingWastageReport | undefined;
}): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReportKpiCard
        icon={Trash2}
        label="Wastage Quantity"
        value={formatNumber(report?.totalWastageQuantity ?? 0)}
      />
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Estimated Wastage Cost"
        value={formatCurrency(report?.estimatedWastageCost ?? 0)}
      />
    </div>
  );
}
