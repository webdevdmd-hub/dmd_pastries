export function formatDateOnly(value: string | null): string {
  if (!value) return "Not set";

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "Not set";

  return new Intl.DateTimeFormat("en-AE", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
