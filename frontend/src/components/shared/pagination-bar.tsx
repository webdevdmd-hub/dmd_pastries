"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

/**
 * The count line and the page steppers for a server-paginated list.
 *
 * Always says how many records there are, because "43 purchase orders" is worth
 * knowing even on a single page. The steppers only appear when there is
 * somewhere to step to.
 */
export function PaginationBar({
  isFetching = false,
  limit,
  noun,
  onPageChange,
  page,
  total,
  totalPages,
}: {
  /** Dims the count while the next page is in flight, without blanking it. */
  isFetching?: boolean;
  limit: number;
  /**
   * Both forms of the noun. A single plural renders "1 bills", and no trimming
   * rule survives "payments made", so callers name both.
   */
  noun: { one: string; other: string };
  onPageChange: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
}): JSX.Element {
  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const hasPages = totalPages > 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-cell-x py-3">
      <p
        aria-live="polite"
        className={
          isFetching
            ? "text-meta tabular-nums text-foreground-muted opacity-60"
            : "text-meta tabular-nums text-foreground-muted"
        }
      >
        {total === 0
          ? `No ${noun.other}`
          : hasPages
            ? `Showing ${String(first)}–${String(last)} of ${String(total)} ${noun.other}`
            : `${String(total)} ${total === 1 ? noun.one : noun.other}`}
      </p>

      {hasPages ? (
        <div className="flex items-center gap-2">
          <Button
            disabled={page <= 1 || isFetching}
            onClick={() => {
              onPageChange(page - 1);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-meta tabular-nums text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages || isFetching}
            onClick={() => {
              onPageChange(page + 1);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
            <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
