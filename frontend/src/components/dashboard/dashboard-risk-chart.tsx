"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";

export type DashboardRiskItem = {
  label: string;
  value: number;
};

export function DashboardRiskChart({ items }: { items: DashboardRiskItem[] }): JSX.Element {
  return (
    <ResponsiveChartFrame ariaLabel="Dashboard risk chart" className="h-48">
      {({ height, width }) => (
        <BarChart
          data={items}
          height={height}
          layout="vertical"
          margin={{ bottom: 4, left: 10, right: 18, top: 4 }}
          width={width}
        >
          <CartesianGrid stroke="#E4E4E7" strokeDasharray="3 3" />
          <XAxis stroke="#71717A" tick={{ fill: "#52525B", fontSize: 12 }} type="number" />
          <YAxis
            dataKey="label"
            stroke="#71717A"
            tick={{ fill: "#52525B", fontSize: 12 }}
            type="category"
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #D4D4D8",
              borderRadius: "6px",
              color: "#171918",
            }}
          />
          <Bar dataKey="value" fill="#171918" radius={[0, 4, 4, 0]} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
