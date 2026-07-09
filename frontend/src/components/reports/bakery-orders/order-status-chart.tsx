"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
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
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Bar dataKey="value" fill="#B08968" radius={8} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
