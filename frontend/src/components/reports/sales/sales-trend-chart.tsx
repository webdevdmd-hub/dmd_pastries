"use client";

import type { JSX } from "react";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { SalesTrendChart as SalesTrendChartData } from "@/types/sales-reports";

const p = palette();

type TrendPoint = {
  label: string;
  netSales: number;
  salesCount: number;
};

function toTrendPoints(chart: SalesTrendChartData): TrendPoint[] {
  const netSales = chart.datasets[0]?.data ?? [];
  const salesCount = chart.datasets[1]?.data ?? [];

  return chart.labels.map((label, index) => ({
    label,
    netSales: netSales[index] ?? 0,
    salesCount: salesCount[index] ?? 0,
  }));
}

export function SalesTrendChart({ chart }: { chart: SalesTrendChartData }): JSX.Element {
  return (
    <ResponsiveChartFrame
      ariaLabel="Sales trend chart showing net sales and sales count"
      className="h-80"
    >
      {({ height, width }) => (
        <LineChart
          data={toTrendPoints(chart)}
          height={height}
          margin={{ bottom: 12, left: 0, right: 12, top: 12 }}
          width={width}
        >
          <CartesianGrid stroke={chartSeries[0]} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke={chartSeries[1]}
            tick={{ fill: chartSeries[1], fontSize: 12 }}
          />
          <YAxis stroke={chartSeries[1]} tick={{ fill: chartSeries[1], fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: p.primary,
              border: `1px solid ${p.border}`,
              borderRadius: "12px",
              color: p.muted,
            }}
          />
          <Legend />
          <Line
            dataKey="netSales"
            name="Net Sales"
            stroke={chartSeries[2]}
            strokeWidth={3}
            type="monotone"
          />
          <Line
            dataKey="salesCount"
            name="Sales Count"
            stroke={chartSeries[1]}
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      )}
    </ResponsiveChartFrame>
  );
}
