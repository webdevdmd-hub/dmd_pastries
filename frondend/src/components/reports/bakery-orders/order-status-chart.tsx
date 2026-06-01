import type { JSX } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { OrderStatusRow } from "@/types/bakery-orders-reports";

export function OrderStatusChart({ rows }: { rows: OrderStatusRow[] }): JSX.Element {
  return (
    <div className="h-72" aria-label="Order status distribution chart">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={rows.map((row) => ({
            name: row.orderStatus.replaceAll("_", " "),
            value: row.ordersCount,
          }))}
        >
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Bar dataKey="value" fill="#B08968" radius={8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
