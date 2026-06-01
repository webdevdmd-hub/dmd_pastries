import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PaymentMethodReportRow } from "@/types/financial-reports";

export function PaymentMethodChart({ rows }: { rows: PaymentMethodReportRow[] }): JSX.Element {
  const chartRows = rows.map((row) => ({
    collected: row.totalCollected,
    method: row.paymentMethodName || row.paymentMethodType || "Method",
    net: row.netCollected,
    refunded: row.totalRefunded,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="h-72" aria-label="Payment method distribution pie chart">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Tooltip />
            <Pie
              data={chartRows}
              dataKey="net"
              fill="#B08968"
              innerRadius={60}
              label
              nameKey="method"
              outerRadius={100}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72" aria-label="Payment method collected and refunded bar chart">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={chartRows}>
            <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
            <XAxis dataKey="method" stroke="#7A553A" />
            <YAxis stroke="#7A553A" />
            <Tooltip />
            <Legend />
            <Bar dataKey="collected" fill="#3B2A22" radius={8} />
            <Bar dataKey="refunded" fill="#B08968" radius={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
