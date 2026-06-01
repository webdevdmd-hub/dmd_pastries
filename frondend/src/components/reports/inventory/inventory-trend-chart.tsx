import type { JSX } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InventoryTrendChart as InventoryTrendChartData } from "@/types/inventory-reports";

export function InventoryTrendChart({ chart }: { chart: InventoryTrendChartData }): JSX.Element {
  const rows = chart.labels.map((label, index) => {
    const row: Record<string, number | string> = { label };
    chart.datasets.forEach((dataset) => {
      row[dataset.label] = dataset.data[index] ?? 0;
    });

    return row;
  });

  return (
    <div className="h-80" aria-label="Inventory stock in and stock out trend chart">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Legend />
          {chart.datasets.map((dataset, index) => (
            <Bar
              dataKey={dataset.label}
              fill={index === 0 ? "#3B2A22" : "#B08968"}
              key={dataset.label}
              radius={8}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
