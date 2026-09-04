import {
  Boxes,
  PackageSearch,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportsDashboardSummary } from "@/types/reports";

function currency(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(value);
}

export function ReportKpiGrid({
  isLoading = false,
  summary,
}: {
  isLoading?: boolean;
  summary: ReportsDashboardSummary | undefined;
}): JSX.Element {
  if (isLoading && !summary) {
    return (
      <ReportKpiRow count={10}>
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton className="h-32 rounded-2xl" key={index} />
        ))}
      </ReportKpiRow>
    );
  }

  return (
    <ReportKpiRow count={10}>
      <ReportKpiCard
        icon={ReceiptText}
        label="Total Sales"
        value={currency(summary?.sales.totalSales ?? 0)}
      />
      <ReportKpiCard
        icon={ShoppingBag}
        label="Sales Count"
        value={number(summary?.sales.salesCount ?? 0)}
      />
      <ReportKpiCard
        icon={TrendingUp}
        label="Average Order"
        value={currency(summary?.sales.averageOrderValue ?? 0)}
      />
      <ReportKpiCard
        icon={WalletCards}
        label="Collected"
        value={currency(summary?.payments.collectedAmount ?? 0)}
      />
      <ReportKpiCard
        icon={WalletCards}
        label="Refunds"
        value={currency(summary?.payments.refundAmount ?? 0)}
      />
      <ReportKpiCard
        icon={PackageSearch}
        label="Low Stock"
        value={number(summary?.inventory.lowStockCount ?? 0)}
      />
      <ReportKpiCard
        icon={PackageSearch}
        label="Expiring Items"
        value={number(summary?.inventory.expiringItemsCount ?? 0)}
      />
      <ReportKpiCard
        icon={Boxes}
        label="Active Batches"
        value={number(summary?.manufacturing.activeBatches ?? 0)}
      />
      <ReportKpiCard
        icon={ShoppingBag}
        label="Pending Orders"
        value={number(summary?.orders.pendingOrders ?? 0)}
      />
      <ReportKpiCard
        icon={ShoppingBag}
        label="Ready Orders"
        value={number(summary?.orders.readyOrders ?? 0)}
      />
    </ReportKpiRow>
  );
}
