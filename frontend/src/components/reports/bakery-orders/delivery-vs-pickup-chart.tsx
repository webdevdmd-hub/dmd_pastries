"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import { chartSeries, palette } from "@/lib/design/palette";
import type { DeliveryVsPickupReport } from "@/types/bakery-orders-reports";

const p = palette();

export function DeliveryVsPickupChart({ report }: { report: DeliveryVsPickupReport }): JSX.Element {
  const rows = [
    { count: report.pickupOrders.count, name: "Pickup", value: report.pickupOrders.totalValue },
    {
      count: report.deliveryOrders.count,
      name: "Delivery",
      value: report.deliveryOrders.totalValue,
    },
  ];
  return (
    <ResponsiveChartFrame ariaLabel="Pickup versus delivery count and value chart" className="h-72">
      {({ height, width }) => (
        <BarChart data={rows} height={height} width={width}>
          <CartesianGrid stroke={chartSeries[0]} strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke={chartSeries[1]} />
          <YAxis stroke={chartSeries[1]} />
          <Tooltip />
          <Bar dataKey="count" fill={p.primary} radius={8} />
          <Bar dataKey="value" fill={chartSeries[2]} radius={8} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
