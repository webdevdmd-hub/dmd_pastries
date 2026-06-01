import { CreditCard } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import type { PaymentMethodReportRow } from "@/types/financial-reports";

export function PaymentMethodReportCard({ rows }: { rows: PaymentMethodReportRow[] }): JSX.Element {
  const totalCollected = rows.reduce((sum, row) => sum + row.totalCollected, 0);
  const totalRefunded = rows.reduce((sum, row) => sum + row.totalRefunded, 0);
  const netCollected = rows.reduce((sum, row) => sum + row.netCollected, 0);
  const transactions = rows.reduce((sum, row) => sum + row.transactionCount, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ReportKpiCard
        icon={CreditCard}
        label="Method Collected"
        value={formatCurrency(totalCollected)}
      />
      <ReportKpiCard
        icon={CreditCard}
        label="Method Refunded"
        value={formatCurrency(totalRefunded)}
      />
      <ReportKpiCard icon={CreditCard} label="Method Net" value={formatCurrency(netCollected)} />
      <ReportKpiCard icon={CreditCard} label="Transactions" value={formatNumber(transactions)} />
    </div>
  );
}
