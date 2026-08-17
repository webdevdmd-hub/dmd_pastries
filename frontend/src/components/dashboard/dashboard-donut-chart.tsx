"use client";

import type { JSX } from "react";
import { Pie, PieChart, Tooltip } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { ReportChartData } from "@/types/reports";

const p = palette();

type DonutPoint = {
  fill: string;
  label: string;
  value: number;
};

const colors = chartSeries;

function toDonutPoints(chart: ReportChartData): DonutPoint[] {
  const dataset = chart.datasets[0];

  return chart.labels.map((label, index) => ({
    fill: colors[index % colors.length] ?? p.primary,
    label,
    value: dataset?.data[index] ?? 0,
  }));
}

export function DashboardDonutChart({ chart }: { chart: ReportChartData }): JSX.Element {
  const data = toDonutPoints(chart);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
      <ResponsiveChartFrame ariaLabel="Dashboard donut chart" className="h-72">
        {({ height, width }) => (
          <PieChart height={height} width={width}>
            <Tooltip
              contentStyle={{
                backgroundColor: p.card,
                border: `1px solid ${p.border}`,
                borderRadius: "6px",
                color: p.primary,
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
        )}
      </ResponsiveChartFrame>
      <div className="flex flex-col justify-center gap-2">
        {data.slice(0, 6).map((point, index) => (
          <div
            className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
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
