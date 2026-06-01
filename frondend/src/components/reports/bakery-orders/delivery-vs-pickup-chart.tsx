import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    <div className="h-72" aria-label="Pickup versus delivery count and value chart">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Bar dataKey="count" fill="#3B2A22" radius={8} />
          <Bar dataKey="value" fill="#B08968" radius={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
