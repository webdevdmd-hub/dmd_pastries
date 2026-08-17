"use client";

import type { JSX } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { ReportChartData } from "@/types/reports";

const p = palette();

type ChartPoint = {
  label: string;
  value: number;
};

function toChartPoints(chart: ReportChartData): ChartPoint[] {
  const dataset = chart.datasets[0];

  return chart.labels.map((label, index) => ({
    label,
    value: dataset?.data[index] ?? 0,
  }));
}

export function SalesChart({ chart }: { chart: ReportChartData }): JSX.Element {
  return (
    <ResponsiveChartFrame ariaLabel="Sales chart" className="h-72">
      {({ height, width }) => (
        <LineChart
          data={toChartPoints(chart)}
          height={height}
          margin={{ bottom: 10, left: 0, right: 10, top: 10 }}
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
          <Line
            activeDot={{ r: 6 }}
            dataKey="value"
            name={chart.datasets[0]?.label ?? "Sales"}
            stroke={chartSeries[2]}
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      )}
    </ResponsiveChartFrame>
  );
}
