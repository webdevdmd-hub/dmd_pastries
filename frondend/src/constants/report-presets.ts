import type { ReportDatePreset, ReportGroupBy, ReportType } from "@/types/reports";

export type ReportPresetOption = {
  label: string;
  value: ReportDatePreset;
};

export const reportDatePresets: ReportPresetOption[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This week", value: "this_week" },
  { label: "This month", value: "this_month" },
  { label: "Last 30 days", value: "last_30_days" },
  { label: "Custom", value: "custom" },
];

export const reportGroupByOptions: { label: string; value: ReportGroupBy }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

export const exportReportTypes: { label: string; value: ReportType }[] = [
  { label: "Sales", value: "sales" },
  { label: "Payments", value: "payments" },
  { label: "Orders", value: "orders" },
  { label: "Inventory", value: "inventory" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Purchasing", value: "purchasing" },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

export function resolveReportPresetRange(preset: ReportDatePreset): {
  dateFrom: string;
  dateTo: string;
} {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  if (preset === "today") {
    return { dateFrom: isoDate(today), dateTo: isoDate(today) };
  }

  if (preset === "yesterday") {
    return { dateFrom: isoDate(yesterday), dateTo: isoDate(yesterday) };
  }

  if (preset === "this_week") {
    return { dateFrom: isoDate(startOfWeek(today)), dateTo: isoDate(today) };
  }

  if (preset === "this_month") {
    return { dateFrom: isoDate(monthStart), dateTo: isoDate(today) };
  }

  return { dateFrom: isoDate(last30Days), dateTo: isoDate(today) };
}
