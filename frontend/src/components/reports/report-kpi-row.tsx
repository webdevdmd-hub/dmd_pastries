import type { JSX, ReactNode } from "react";

/**
 * The summary strip above a report: one row at every width.
 *
 * Stat cards two-across on a phone filled most of a screen before the report
 * itself appeared, and these are context for the numbers below rather than the
 * reason anyone opened the page. So the strip scrolls sideways instead of
 * wrapping to a second line.
 *
 * Whether it stops scrolling and becomes an even grid depends on how many cards
 * there are, because the constraint is width per card, not card count. A report
 * column is roughly 1100px on a 1440px screen once the sidebar is out; four
 * cards have room from sm, five or six need md, and seven or more never get
 * enough, so those keep scrolling at every width rather than being squeezed
 * into slivers.
 *
 * Children are sized from here rather than inside ReportKpiCard, which is also
 * used on its own and should not carry a row's layout.
 */
const gridFrom: Record<number, string> = {
  2: "sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto",
  3: "sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto",
  4: "sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto",
  5: "md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0 md:[&>*]:w-auto",
  6: "md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0 md:[&>*]:w-auto",
};

export function ReportKpiRow({
  children,
  count,
}: {
  children: ReactNode;
  /** How many cards the row holds. Seven or more scrolls at every width. */
  count: number;
}): JSX.Element {
  return (
    <div
      className={`scrollbar-hidden flex min-w-0 gap-3 overflow-x-auto pb-1 [&>*]:w-40 [&>*]:shrink-0 ${
        gridFrom[count] ?? ""
      }`}
    >
      {children}
    </div>
  );
}
