"use client";

import type { JSX } from "react";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { ReportChartData } from "@/types/reports";

type DonutPoint = {
  fill: string;
  label: string;
  value: number;
};

const colors = ["#B08968", "#7A553A", "#D6BFA6", "#3B2A22", "#F3E9D7"];

function toDonutPoints(chart: ReportChartData): DonutPoint[] {
  const dataset = chart.datasets[0];

  return chart.labels.map((label, index) => ({
    fill: colors[index % colors.length] ?? "#B08968",
    label,
    value: dataset?.data[index] ?? 0,
  }));
}

export function DashboardDonutChart({ chart }: { chart: ReportChartData }): JSX.Element {
  const data = toDonutPoints(chart);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
      <div className="h-72" aria-label="Dashboard donut chart">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                backgroundColor: "#3B2A22",
                border: "1px solid #B08968",
                borderRadius: "14px",
                color: "#F3E9D7",
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              innerRadius="58%"
              nameKey="label"
              outerRadius="86%"
              paddingAngle={4}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center gap-2">
        {data.slice(0, 6).map((point, index) => (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl bg-brand-latte/70 px-3 py-2 text-sm"
            key={point.label}
          >
            <span className="flex items-center gap-2 text-brand-mocha">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              {point.label}
            </span>
            <strong className="text-brand-espresso">{point.value.toLocaleString("en-AE")}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
