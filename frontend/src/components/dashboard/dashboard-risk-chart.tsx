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
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis stroke="#7A553A" tick={{ fill: "#7A553A", fontSize: 12 }} type="number" />
          <YAxis
            dataKey="label"
            stroke="#7A553A"
            tick={{ fill: "#7A553A", fontSize: 12 }}
            type="category"
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#3B2A22",
              border: "1px solid #B08968",
              borderRadius: "14px",
              color: "#F3E9D7",
            }}
          />
          <Bar dataKey="value" fill="#B08968" radius={[0, 10, 10, 0]} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
