import type { JSX } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { FinancialTrendChart as FinancialTrendChartData } from "@/types/financial-reports";

const colors = ["#3B2A22", "#B08968", "#7A553A", "#D6BFA6"];

export function FinancialTrendChart({ chart }: { chart: FinancialTrendChartData }): JSX.Element {
  const rows = chart.labels.map((label, index) => {
    const row: Record<string, number | string> = { label };
    chart.datasets.forEach((dataset) => {
      row[dataset.label] = dataset.data[index] ?? 0;
    });
    return row;
  });

  return (
    <div className="h-80" aria-label="Financial collected refunded and net trend chart">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="#D6BFA6" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#7A553A" />
          <YAxis stroke="#7A553A" />
          <Tooltip />
          <Legend />
          {chart.datasets.map((dataset, index) => (
            <Line
              dataKey={dataset.label}
              key={dataset.label}
              stroke={colors[index % colors.length] ?? "#3B2A22"}
              strokeWidth={3}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
