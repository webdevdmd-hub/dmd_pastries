import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  ClockAlert,
  PackageCheck,
  PackageX,
  ShieldAlert,
} from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { InventorySummary } from "@/types/inventory-reports";

export function InventorySummaryCards({
  summary,
}: {
  summary: InventorySummary | undefined;
}): JSX.Element {
  return (
    <ReportKpiRow count={7}>
      <ReportKpiCard
        icon={Boxes}
        label="Total Items"
        value={formatNumber(summary?.totalInventoryItems ?? 0)}
      />
      <ReportKpiCard
        icon={PackageCheck}
        label="Active Items"
        value={formatNumber(summary?.activeInventoryItems ?? 0)}
      />
      <ReportKpiCard
        icon={AlertTriangle}
        label="Low Stock"
        value={formatNumber(summary?.lowStockCount ?? 0)}
      />
      <ReportKpiCard
        icon={PackageX}
        label="Out of Stock"
        value={formatNumber(summary?.outOfStockCount ?? 0)}
      />
      <ReportKpiCard
        icon={ShieldAlert}
        label="Expiry Tracked"
        value={formatNumber(summary?.expiryTrackedCount ?? 0)}
      />
      <ReportKpiCard
        icon={ClockAlert}
        label="Expiring Soon"
        value={formatNumber(summary?.expiringSoonCount ?? 0)}
      />
      <ReportKpiCard
        icon={CircleDollarSign}
        label="Stock Value"
        value={formatCurrency(summary?.totalStockValue ?? 0)}
      />
    </ReportKpiRow>
  );
}
