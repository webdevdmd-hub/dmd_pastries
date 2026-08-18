import { CakeSlice } from "lucide-react";
import type { JSX } from "react";

import { ReportEmptyState } from "@/components/reports/report-empty-state";

/**
 * Module adapter for the report zero-row state. All behaviour lives in
 * ReportEmptyState; this only supplies the module icon and keeps the call
 * signature stable.
 */
export function BakeryOrdersReportEmptyState(props: {
  message: string;
  noun?: string | undefined;
  isFiltered?: boolean | undefined;
  onClearFilters?: (() => void) | undefined;
}): JSX.Element {
  return <ReportEmptyState {...props} icon={CakeSlice} />;
}
