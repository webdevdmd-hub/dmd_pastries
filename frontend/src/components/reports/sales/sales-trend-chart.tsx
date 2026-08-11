"use client";

import type { JSX } from "react";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import type { SalesTrendChart as SalesTrendChartData } from "@/types/sales-reports";

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
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
          <YAxis stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#3B2A22",
              border: "1px solid #B08968",
              borderRadius: "12px",
              color: "#F3E9D7",
            }}
          />
          <Legend />
          <Line
            dataKey="netSales"
            name="Net Sales"
            stroke="#B08968"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            dataKey="salesCount"
            name="Sales Count"
            stroke="#7A553A"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      )}
    </ResponsiveChartFrame>
  );
}
