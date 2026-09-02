import {
  BadgePercent,
  ReceiptText,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { SalesSummary } from "@/types/sales-reports";

export function SalesSummaryCards({ summary }: { summary: SalesSummary | undefined }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <ReportKpiCard
        icon={ReceiptText}
        label="Gross Sales"
        trend="flat"
        value={formatCurrency(summary?.grossSales ?? 0)}
        {...(summary ? { changePercentage: summary.grossSalesChangePercentage } : {})}
      />
      <ReportKpiCard
        icon={TrendingUp}
        label="Net Sales"
        trend="flat"
        value={formatCurrency(summary?.netSales ?? 0)}
        {...(summary ? { changePercentage: summary.netSalesChangePercentage } : {})}
      />
      <ReportKpiCard
        icon={ShoppingBag}
        label="Sales Count"
        trend="flat"
        value={formatNumber(summary?.salesCount ?? 0)}
        {...(summary ? { changePercentage: summary.salesCountChangePercentage } : {})}
      />
      <ReportKpiCard
        icon={ShoppingBag}
        label="Items Sold"
        value={formatNumber(summary?.itemsSold ?? 0)}
      />
      <ReportKpiCard
        icon={WalletCards}
        label="Average Order"
        value={formatCurrency(summary?.averageOrderValue ?? 0)}
      />
      <ReportKpiCard
        icon={BadgePercent}
        label="Discount Total"
        value={formatCurrency(summary?.discountTotal ?? 0)}
      />
      <ReportKpiCard
        icon={WalletCards}
        label="Tax Total"
        value={formatCurrency(summary?.taxTotal ?? 0)}
      />
      <ReportKpiCard
        icon={TrendingDown}
        label="Refund Total"
        value={formatCurrency(summary?.refundTotal ?? 0)}
      />
    </div>
  );
}
