import { formatDateOnly } from "@/lib/utils/date-only";

const currencyFormatter = new Intl.NumberFormat("en-AE", {
  currency: "AED",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatCurrency(value: number): string {
  return currencyFormatter.format(toFiniteNumber(value));
}

export function formatChartCurrency(value: unknown): string {
  return formatCurrency(toFiniteNumber(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export function formatDate(value: string): string {
  return formatDateOnly(value);
}
