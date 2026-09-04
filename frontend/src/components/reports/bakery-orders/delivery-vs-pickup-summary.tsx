import { CakeSlice, Truck } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { DeliveryVsPickupReport } from "@/types/bakery-orders-reports";

export function DeliveryVsPickupSummary({
  report,
}: {
  report: DeliveryVsPickupReport | undefined;
}): JSX.Element {
  return (
    <ReportKpiRow count={4}>
      <ReportKpiCard
        icon={CakeSlice}
        label="Pickup Count"
        value={formatNumber(report?.pickupOrders.count ?? 0)}
      />
      <ReportKpiCard
        icon={CakeSlice}
        label="Pickup Value"
        value={formatCurrency(report?.pickupOrders.totalValue ?? 0)}
      />
      <ReportKpiCard
        icon={Truck}
        label="Delivery Count"
        value={formatNumber(report?.deliveryOrders.count ?? 0)}
      />
      <ReportKpiCard
        icon={Truck}
        label="Delivery Value"
        value={formatCurrency(report?.deliveryOrders.totalValue ?? 0)}
      />
    </ReportKpiRow>
  );
}
