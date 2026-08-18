import type { JSX } from "react";

import { ReportEmptyState } from "@/components/reports/report-empty-state";

/** Module adapter — see report-empty-state.tsx for the empty/filtered rule. */
export function SalesReportEmptyState(props: {
  message: string;
  noun?: string | undefined;
  isFiltered?: boolean | undefined;
  onClearFilters?: (() => void) | undefined;
}): JSX.Element {
  return <ReportEmptyState {...props} />;
}
