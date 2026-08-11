"use client";

import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ResponsiveChartFrame } from "@/components/reports/responsive-chart-frame";
import type { DeliveryVsPickupReport } from "@/types/bakery-orders-reports";

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
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Bar dataKey="count" fill="#3B2A22" radius={8} />
          <Bar dataKey="value" fill="#B08968" radius={8} />
        </BarChart>
      )}
    </ResponsiveChartFrame>
  );
}
