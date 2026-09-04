import { BadgePercent, ReceiptText } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/components/reports/sales/sales-report-format";
import type { DiscountReport } from "@/types/sales-reports";

export function DiscountSummaryCard({
  report,
}: {
  report: DiscountReport | undefined;
}): JSX.Element {
  return (
    <ReportKpiRow columns={5}>
      <ReportKpiCard
        icon={BadgePercent}
        label="Total Discount"
        value={formatCurrency(report?.totalDiscount ?? 0)}
      />
      <ReportKpiCard
        icon={BadgePercent}
        label="Sale-Level Discount"
        value={formatCurrency(report?.saleLevelDiscount ?? 0)}
      />
      <ReportKpiCard
        icon={BadgePercent}
        label="Line-Level Discount"
        value={formatCurrency(report?.lineLevelDiscount ?? 0)}
      />
      <ReportKpiCard
        icon={ReceiptText}
        label="Discounted Sales"
        value={formatNumber(report?.discountedSalesCount ?? 0)}
      />
      <ReportKpiCard
        icon={BadgePercent}
        label="Discount % Gross"
        value={formatPercent(report?.discountPercentageOfGrossSales ?? 0)}
      />
    </ReportKpiRow>
  );
}
