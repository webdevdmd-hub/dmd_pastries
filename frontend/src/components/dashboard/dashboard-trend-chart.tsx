"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { ReportChartData } from "@/types/reports";

const p = palette();

type ChartPoint = {
  label: string;
} & Record<string, number | string>;

function toChartPoints(chart: ReportChartData): ChartPoint[] {
  return chart.labels.map((label, index) => {
    const point: ChartPoint = { label };

    chart.datasets.forEach((dataset, datasetIndex) => {
      point[`value${String(datasetIndex)}`] = dataset.data[index] ?? 0;
    });

    return point;
  });
}

const colors = chartSeries;

export function DashboardTrendChart({
  chart,
  type = "area",
}: {
  chart: ReportChartData;
  type?: "area" | "bar";
}): JSX.Element {
  const data = toChartPoints(chart);

  if (type === "bar") {
    return (
      <ResponsiveChartFrame ariaLabel="Dashboard bar chart" className="h-72">
        {({ height, width }) => (
          <BarChart
            data={data}
            height={height}
            margin={{ bottom: 8, left: 0, right: 8, top: 8 }}
            width={width}
          >
            <CartesianGrid stroke={p.border} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke={p.foregroundMuted}
              tick={{ fill: p.foregroundMuted, fontSize: 12 }}
            />
            <YAxis stroke={p.foregroundMuted} tick={{ fill: p.foregroundMuted, fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: p.card,
                border: `1px solid ${p.border}`,
                borderRadius: "6px",
                color: p.primary,
              }}
            />
            <Legend />
            {chart.datasets.slice(0, 3).map((dataset, index) => (
              <Bar
                dataKey={`value${String(index)}`}
                fill={colors[index] ?? p.primary}
                key={dataset.label}
                name={dataset.label}
                radius={[10, 10, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveChartFrame>
    );
  }

  return (
    <ResponsiveChartFrame ariaLabel="Dashboard trend chart" className="h-72">
      {({ height, width }) => (
        <AreaChart
          data={data}
          height={height}
          margin={{ bottom: 8, left: 0, right: 8, top: 8 }}
          width={width}
        >
          <defs>
            <linearGradient id="dashboardTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={p.primary} stopOpacity={0.22} />
              <stop offset="95%" stopColor={p.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={p.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke={p.foregroundMuted}
            tick={{ fill: p.foregroundMuted, fontSize: 12 }}
          />
          <YAxis stroke={p.foregroundMuted} tick={{ fill: p.foregroundMuted, fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: p.card,
              border: `1px solid ${p.border}`,
              borderRadius: "6px",
              color: p.primary,
            }}
          />
          <Legend />
          {chart.datasets.slice(0, 3).map((dataset, index) => (
            <Area
              dataKey={`value${String(index)}`}
              fill={index === 0 ? "url(#dashboardTrendFill)" : colors[index]}
              fillOpacity={index === 0 ? 1 : 0.15}
              key={dataset.label}
              name={dataset.label}
              stroke={colors[index] ?? p.primary}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveChartFrame>
  );
}
