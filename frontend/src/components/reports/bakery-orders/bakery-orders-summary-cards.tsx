import { CakeSlice, CircleDollarSign, Clock, PackageCheck, Truck } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { BakeryOrdersSummary } from "@/types/bakery-orders-reports";

export function BakeryOrdersSummaryCards({
  summary,
}: {
  summary: BakeryOrdersSummary | undefined;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <ReportKpiCard
        icon={CakeSlice}
        label="Total Orders"
        value={formatNumber(summary?.totalOrders ?? 0)}
      />
      <ReportKpiCard
        icon={Clock}
        label="Pending"
        value={formatNumber(summary?.pendingOrders ?? 0)}
      />
      <ReportKpiCard
        icon={Clock}
        label="In Production"
        value={formatNumber(summary?.inProductionOrders ?? 0)}
      />
      <ReportKpiCard
        icon={PackageCheck}
        label="Ready"
        value={formatNumber(summary?.readyOrders ?? 0)}
      />
      <ReportKpiCard
        icon={PackageCheck}
        label="Completed"
        value={formatNumber(summary?.completedOrders ?? 0)}
      />
      <ReportKpiCard
        icon={CakeSlice}
        label="Pickup Orders"
        value={formatNumber(summary?.pickupOrders ?? 0)}
      />
      <ReportKpiCard
        icon={Truck}
        label="Delivery Orders"
        value={formatNumber(summary?.deliveryOrders ?? 0)}
      />
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Pending Balance"
        value={formatCurrency(summary?.balancePending ?? 0)}
      />
    </div>
  );
}
