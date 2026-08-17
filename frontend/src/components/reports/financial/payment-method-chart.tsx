"use client";

import type { JSX } from "react";
import type { PieLabelRenderProps } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { formatChartCurrency } from "@/components/reports/sales/sales-report-format";
import { chartSeries, palette } from "@/lib/design/palette";
import type { PaymentMethodReportRow } from "@/types/financial-reports";

const p = palette();

function formatPieLabel(props: PieLabelRenderProps): string {
  const method = typeof props.name === "string" ? props.name : "Method";
  return `${method}: ${formatChartCurrency(props.value)}`;
}

export function PaymentMethodChart({ rows }: { rows: PaymentMethodReportRow[] }): JSX.Element {
  const chartRows = rows.map((row) => ({
    collected: row.totalCollected,
    method: row.paymentMethodName || row.paymentMethodType || "Method",
    net: row.netCollected,
    refunded: row.totalRefunded,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ResponsiveChartFrame ariaLabel="Payment method distribution pie chart" className="h-72">
        {({ height, width }) => (
          <PieChart height={height} width={width}>
            <Tooltip formatter={formatChartCurrency} />
            <Pie
              data={chartRows}
              dataKey="net"
              fill={chartSeries[0]}
              innerRadius={60}
              label={formatPieLabel}
              nameKey="method"
              outerRadius={100}
            />
          </PieChart>
        )}
      </ResponsiveChartFrame>
      <ResponsiveChartFrame
        ariaLabel="Payment method collected and refunded bar chart"
        className="h-72"
      >
        {({ height, width }) => (
          <BarChart data={chartRows} height={height} width={width}>
            <CartesianGrid stroke={chartSeries[1]} strokeDasharray="3 3" />
            <XAxis dataKey="method" stroke={chartSeries[2]} />
            <YAxis stroke={chartSeries[2]} tickFormatter={formatChartCurrency} />
            <Tooltip formatter={formatChartCurrency} />
            <Legend />
            <Bar dataKey="collected" fill={p.primary} radius={8} />
            <Bar dataKey="refunded" fill={chartSeries[0]} radius={8} />
          </BarChart>
        )}
      </ResponsiveChartFrame>
    </div>
  );
}
