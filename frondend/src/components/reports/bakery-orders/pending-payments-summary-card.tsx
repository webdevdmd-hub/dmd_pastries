import { CircleDollarSign } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency } from "@/components/reports/sales/sales-report-format";
import type { PendingPaymentRow } from "@/types/bakery-orders-reports";

export function PendingPaymentsSummaryCard({ rows }: { rows: PendingPaymentRow[] }): JSX.Element {
  const total = rows.reduce((sum, row) => sum + row.balanceAmount, 0);
  return (
    <ReportKpiCard
      icon={CircleDollarSign}
      label="Total Pending Balance"
      value={formatCurrency(total)}
    />
  );
}
