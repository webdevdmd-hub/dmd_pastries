/**
 * A payment method's type, shown only when it says something the name does not.
 *
 * Payment methods carry a name the operator chose ("Cash", "Etisalat card
 * terminal") and a type the system uses ("cash", "card", "bank_transfer").
 * Payments Made printed both, so the method a bakery calls "Cash" read
 *
 *   Cash
 *   cash
 *
 * on every row: a second line that repeats the first and reads like a glitch.
 * A type is worth showing only when it adds something, as "Etisalat card
 * terminal / card" does.
 *
 * Regression: ISSUE-029 — Payments Made printed the method name and its type twice over
 * Found by /qa on 2026-09-16
 * Report: .gstack/qa-reports/qa-report-module-audit-2026-09-14.md
 */
export function paymentMethodTypeNote(name: string, type: string): string | null {
  const readable = type.replaceAll("_", " ").trim();
  if (!readable) {
    return null;
  }
  return readable.toLowerCase() === name.replaceAll("_", " ").trim().toLowerCase()
    ? null
    : readable;
}
