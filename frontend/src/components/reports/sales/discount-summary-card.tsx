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

// The sale-level and line-level cards are gone.
//
// They were not two halves of the total: a sale-level discount is
// allocated INTO each line at checkout and the sale header is then the sum
// of those lines, so both cards showed the same money and "Total Discount"
// added them. One comped sale of 351.00 read 702.00 of discount against a
// sale total of 0.00.
//
// The split is not recoverable either, because the allocation overwrites
// the line's own discount rather than sitting beside it. One honest total
// beats two figures that are each the whole amount.
//
// Regression: ISSUE-013 — the discount report counted every discount twice
// Found by /qa on 2026-09-14
export function DiscountSummaryCard({
  report,
}: {
  report: DiscountReport | undefined;
}): JSX.Element {
  return (
    <ReportKpiRow count={3}>
      <ReportKpiCard
        icon={BadgePercent}
        label="Total Discount"
        value={formatCurrency(report?.totalDiscount ?? 0)}
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
