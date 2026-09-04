import { CircleDollarSign, Factory, PackageCheck, PackageX, Scale, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import type { ManufacturingSummary } from "@/types/manufacturing-reports";

export function ManufacturingSummaryCards({
  summary,
}: {
  summary: ManufacturingSummary | undefined;
}): JSX.Element {
  return (
    <ReportKpiRow count={8}>
      <ReportKpiCard
        icon={Factory}
        label="Total Batches"
        value={formatNumber(summary?.totalBatches ?? 0)}
      />
      <ReportKpiCard
        icon={PackageCheck}
        label="Completed"
        value={formatNumber(summary?.completedBatches ?? 0)}
      />
      <ReportKpiCard
        icon={PackageX}
        label="Cancelled"
        value={formatNumber(summary?.cancelledBatches ?? 0)}
      />
      <ReportKpiCard
        icon={Scale}
        label="Planned Qty"
        value={formatNumber(summary?.totalPlannedQuantity ?? 0)}
      />
      <ReportKpiCard
        icon={Scale}
        label="Produced Qty"
        value={formatNumber(summary?.totalProducedQuantity ?? 0)}
      />
      <ReportKpiCard
        icon={PackageCheck}
        label="Yield Efficiency"
        value={formatPercent(summary?.yieldEfficiencyPercentage ?? 0)}
      />
      <ReportKpiCard
        icon={Trash2}
        label="Wastage Qty"
        value={formatNumber(summary?.totalWastageQuantity ?? 0)}
      />
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Production Cost"
        value={formatCurrency(summary?.estimatedProductionCost ?? 0)}
      />
    </ReportKpiRow>
  );
}
