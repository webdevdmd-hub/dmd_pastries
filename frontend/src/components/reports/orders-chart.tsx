"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

export function OrdersChart({ chart }: { chart: ReportChartData }): JSX.Element {
  return (
    <div className="h-72" aria-label="Orders chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={toChartPoints(chart)} margin={{ bottom: 10, left: 0, right: 10, top: 10 }}>
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
            fill="#B08968"
            name={chart.datasets[0]?.label ?? "Orders"}
            radius={8}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
