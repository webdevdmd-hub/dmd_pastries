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

const colors = ["#171918", "#45B894", "#F2735B"];

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
            <CartesianGrid stroke="#E4E4E7" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke="#71717A" tick={{ fill: "#52525B", fontSize: 12 }} />
            <YAxis stroke="#71717A" tick={{ fill: "#52525B", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #D4D4D8",
                borderRadius: "6px",
                color: "#171918",
              }}
            />
            <Legend />
            {chart.datasets.slice(0, 3).map((dataset, index) => (
              <Bar
                dataKey={`value${String(index)}`}
                fill={colors[index] ?? "#171918"}
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
              <stop offset="5%" stopColor="#171918" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#171918" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E4E4E7" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#71717A" tick={{ fill: "#52525B", fontSize: 12 }} />
          <YAxis stroke="#71717A" tick={{ fill: "#52525B", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #D4D4D8",
              borderRadius: "6px",
              color: "#171918",
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
              stroke={colors[index] ?? "#171918"}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </AreaChart>
      )}
    </ResponsiveChartFrame>
  );
}
