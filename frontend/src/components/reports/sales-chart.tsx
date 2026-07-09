"use client";

import type { JSX } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import type { ReportChartData } from "@/types/reports";

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
          <Line
            activeDot={{ r: 6 }}
            dataKey="value"
            name={chart.datasets[0]?.label ?? "Sales"}
            stroke="#B08968"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      )}
    </ResponsiveChartFrame>
  );
}
