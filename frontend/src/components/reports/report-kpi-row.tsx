import type { JSX, ReactNode } from "react";

/**
 * The summary strip above a report: one row at every width.
 *
 * Stat cards two-across on a phone filled most of a screen before the report
 * itself appeared, and these are context for the numbers below rather than the
 * reason anyone opened the page. So below the breakpoint the row scrolls
 * sideways instead of wrapping, and above it the cards share the width evenly.
 *
 * The breakpoint moves with the count because the failure is width per card,
 * not card count: four cards have room from sm, six do not until md, and ten
 * never fit a real content column at all, so that row simply keeps scrolling.
 *
 * Children are sized from here rather than inside ReportKpiCard, which is also
 * used outside a row and should not carry a row's layout.
 */
const rowClass: Record<4 | 5 | 6 | 10, string> = {
  4: "sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto",
  5: "md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0 md:[&>*]:w-auto",
  6: "md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0 md:[&>*]:w-auto",
  10: "",
};

export function ReportKpiRow({
  children,
  columns,
}: {
  children: ReactNode;
  columns: 4 | 5 | 6 | 10;
}): JSX.Element {
  return (
    <div
      className={`scrollbar-hidden flex min-w-0 gap-3 overflow-x-auto pb-1 [&>*]:w-40 [&>*]:shrink-0 ${rowClass[columns]}`}
    >
      {children}
    </div>
  );
}
