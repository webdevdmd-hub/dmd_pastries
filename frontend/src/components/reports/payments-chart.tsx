"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

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

export function PaymentsChart({ chart }: { chart: ReportChartData }): JSX.Element {
  return (
    <ResponsiveChartFrame ariaLabel="Payments chart" className="h-72">
      {({ height, width }) => (
        <BarChart
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
          <Bar
            dataKey="value"
            fill="#7A553A"
            name={chart.datasets[0]?.label ?? "Payments"}
            radius={8}
          />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
