"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { BakeryOrdersTrendChart as BakeryOrdersTrendChartData } from "@/types/bakery-orders-reports";

const p = palette();

export function BakeryOrdersTrendChart({
  chart,
}: {
  chart: BakeryOrdersTrendChartData;
}): JSX.Element {
  const rows = chart.labels.map((label, index) => {
    const row: Record<string, number | string> = { label };
    chart.datasets.forEach((dataset) => {
      row[dataset.label] = dataset.data[index] ?? 0;
    });
    return row;
  });
  return (
    <ResponsiveChartFrame ariaLabel="Bakery orders and revenue trend chart" className="h-80">
      {({ height, width }) => (
        <BarChart data={rows} height={height} width={width}>
          <CartesianGrid stroke={chartSeries[0]} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={chartSeries[1]} />
          <YAxis stroke={chartSeries[1]} />
          <Tooltip />
          <Legend />
          {chart.datasets.map((dataset, index) => (
            <Bar
              dataKey={dataset.label}
              fill={index === 0 ? p.primary : chartSeries[2]}
              key={dataset.label}
              radius={8}
            />
          ))}
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
