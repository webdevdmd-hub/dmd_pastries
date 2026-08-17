"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries } from "@/lib/design/palette";
import type { OrderStatusRow } from "@/types/bakery-orders-reports";

export function OrderStatusChart({ rows }: { rows: OrderStatusRow[] }): JSX.Element {
  return (
    <ResponsiveChartFrame ariaLabel="Order status distribution chart" className="h-72">
      {({ height, width }) => (
        <BarChart
          data={rows.map((row) => ({
            name: row.orderStatus.replaceAll("_", " "),
            value: row.ordersCount,
          }))}
          height={height}
          width={width}
        >
          <CartesianGrid stroke={chartSeries[0]} strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke={chartSeries[1]} />
          <YAxis stroke={chartSeries[1]} />
          <Tooltip />
          <Bar dataKey="value" fill={chartSeries[2]} radius={8} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
