"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DashboardRiskItem = {
  label: string;
  value: number;
};

export function DashboardRiskChart({ items }: { items: DashboardRiskItem[] }): JSX.Element {
  return (
    <div className="h-48" aria-label="Dashboard risk chart">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={items}
          layout="vertical"
          margin={{ bottom: 4, left: 10, right: 18, top: 4 }}
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
      </ResponsiveContainer>
    </div>
  );
}
