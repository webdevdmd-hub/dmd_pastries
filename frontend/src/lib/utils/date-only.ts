const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateParts(value: string): { day: number; month: number; year: number } | null {
  const trimmed = value.trim();
  const dateOnly = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;

  if (!DATE_ONLY_PATTERN.test(dateOnly)) {
    return null;
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { day, month, year };
}

export function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${String(year)}-${month}-${day}`;
}

export function toDateOnlyInputValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return dateParts(value) ? value.trim().slice(0, 10) : "";
}

export function formatDateOnly(value: string | null | undefined, fallback = "-"): string {
  if (!value) {
    return fallback;
  }

  const parts = dateParts(value);
  if (!parts) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}
