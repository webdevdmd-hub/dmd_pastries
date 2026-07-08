import { CircleDollarSign } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";

export function PendingPaymentsSummaryCard({
  totalPendingBalance,
}: {
  totalPendingBalance: number;
}): JSX.Element {
  return (
    <ReportKpiCard
      icon={CircleDollarSign}
      label="Total Pending Balance"
      value={formatCurrency(totalPendingBalance)}
    />
  );
}
