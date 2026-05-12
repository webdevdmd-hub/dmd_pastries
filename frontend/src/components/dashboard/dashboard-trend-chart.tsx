"use client";

import type { JSX } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ReportChartData } from "@/types/reports";

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

const colors = ["#B08968", "#7A553A", "#D6BFA6"];

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
      <div className="h-72" aria-label="Dashboard bar chart">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data} margin={{ bottom: 8, left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
            <YAxis stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#3B2A22",
                border: "1px solid #B08968",
                borderRadius: "14px",
                color: "#F3E9D7",
              }}
            />
            <Legend />
            {chart.datasets.slice(0, 3).map((dataset, index) => (
              <Bar
                dataKey={`value${String(index)}`}
                fill={colors[index] ?? "#B08968"}
                key={dataset.label}
                name={dataset.label}
                radius={[10, 10, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-72" aria-label="Dashboard trend chart">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ bottom: 8, left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="dashboardTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#B08968" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#B08968" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
          <YAxis stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#3B2A22",
              border: "1px solid #B08968",
              borderRadius: "14px",
              color: "#F3E9D7",
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
              stroke={colors[index] ?? "#B08968"}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
