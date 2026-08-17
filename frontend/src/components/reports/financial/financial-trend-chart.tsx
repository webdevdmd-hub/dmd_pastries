"use client";

import type { JSX } from "react";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { formatChartCurrency } from "@/components/reports/sales/sales-report-format";
import { chartSeries, palette } from "@/lib/design/palette";
import type { FinancialTrendChart as FinancialTrendChartData } from "@/types/financial-reports";

const p = palette();

const colors = chartSeries;

export function FinancialTrendChart({ chart }: { chart: FinancialTrendChartData }): JSX.Element {
  const rows = chart.labels.map((label, index) => {
    const row: Record<string, number | string> = { label };
    chart.datasets.forEach((dataset) => {
      row[dataset.label] = dataset.data[index] ?? 0;
    });
    return row;
  });

  return (
    <ResponsiveChartFrame
      ariaLabel="Financial collected refunded and net trend chart"
      className="h-80"
    >
      {({ height, width }) => (
        <LineChart data={rows} height={height} width={width}>
          <CartesianGrid stroke={chartSeries[2]} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={chartSeries[1]} />
          <YAxis stroke={chartSeries[1]} tickFormatter={formatChartCurrency} />
          <Tooltip formatter={formatChartCurrency} />
          <Legend />
          {chart.datasets.map((dataset, index) => (
            <Line
              dataKey={dataset.label}
              key={dataset.label}
              stroke={colors[index % colors.length] ?? p.primary}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </LineChart>
      )}
    </ResponsiveChartFrame>
  );
}
