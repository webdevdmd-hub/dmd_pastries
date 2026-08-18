import { FileText, type LucideIcon } from "lucide-react";
import type { JSX } from "react";

import { EmptyState, FilteredState } from "@/components/shared/collection-state";

/**
 * The zero-row state for a report (DESIGN.md §8).
 *
 * Reports are a special case of the empty/filtered split. A list is filtered
 * when the user narrows it; a report is ALWAYS scoped to a date range, so
 * "nothing to show" has two quite different causes:
 *
 *   - the report sits on its default range with no extra filters and there is
 *     genuinely nothing to report -> EmptyState, worded for the period
 *   - the user changed the range or added a filter -> FilteredState, which says
 *     so and offers the way back
 *
 * The default range deliberately does NOT count as "filtered". Counting it
 * would tell a brand-new tenant with no data at all that their filters are too
 * narrow, sending them to fiddle with a date picker instead of recording their
 * first sale.
 */
export function ReportEmptyState({
  icon,
  isFiltered,
  message,
  noun,
  onClearFilters,
}: {
  /** Wording for the genuinely-empty case, e.g. "No payments in this period." */
  message: string;
  icon?: LucideIcon | undefined;
  /** Plural noun for the filtered case, e.g. "payments". */
  noun?: string | undefined;
  /** True when the applied filters differ from the report's own defaults. */
  isFiltered?: boolean | undefined;
  onClearFilters?: (() => void) | undefined;
}): JSX.Element {
  if (isFiltered && noun && onClearFilters) {
    return <FilteredState noun={noun} onClearFilters={onClearFilters} />;
  }

  return <EmptyState icon={icon ?? FileText} title={message} />;
}
