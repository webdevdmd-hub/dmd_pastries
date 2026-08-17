"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { palette } from "@/lib/design/palette";

const p = palette();

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
          <CartesianGrid stroke={p.border} strokeDasharray="3 3" />
          <XAxis
            stroke={p.foregroundMuted}
            tick={{ fill: p.foregroundMuted, fontSize: 12 }}
            type="number"
          />
          <YAxis
            dataKey="label"
            stroke={p.foregroundMuted}
            tick={{ fill: p.foregroundMuted, fontSize: 12 }}
            type="category"
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: p.card,
              border: `1px solid ${p.border}`,
              borderRadius: "6px",
              color: p.primary,
            }}
          />
          <Bar dataKey="value" fill={p.primary} radius={[0, 4, 4, 0]} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
