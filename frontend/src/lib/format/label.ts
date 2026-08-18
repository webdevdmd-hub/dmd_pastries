/**
 * Turns a raw backend enum or seeded key into something a person should read.
 *
 * Use a `*_LABELS` record instead whenever the value set is a closed union you
 * control (see PAYMENT_STATUS_LABELS in types/payment.ts). This helper is for
 * open string fields whose values come from seeded or operator-entered data,
 * where no exhaustive map is possible.
 *
 * formatLabel("bank_transfer") === "Bank Transfer"
 * formatLabel("active")        === "Active"
 */
export function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
