"use client";

import type { JSX } from "react";

import { Button } from "@/components/ui/button";

type SuppliersPaginationProps = {
  page: number;
  pageSize: number;
  /** Rows held on the client (capped by the request limit). */
  loaded: number;
  /** Server-side total for the filter; may exceed `loaded`. */
  total: number;
  onPageChange: (page: number) => void;
};

/**
 * The control the list shipped without.
 *
 * There was no pagination UI of any kind and no page params on the request, so
 * the list was whatever the backend's default limit returned and nothing said
 * so. Rows are now paged here; when the server's total exceeds what one request
 * carries, the strip says that outright instead of implying the list is whole.
 */
export function SuppliersPagination({
  page,
  pageSize,
  loaded,
  total,
  onPageChange,
}: SuppliersPaginationProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(loaded / pageSize));
  const from = loaded === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, loaded);
  const truncated = total > loaded;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted px-4 py-2.5">
      <p className="text-meta tabular-nums text-foreground-muted">
        Showing {from}&ndash;{to} of {loaded}
        {truncated ? (
          <> loaded, {total} match these filters &mdash; narrow the search to reach the rest</>
        ) : null}
      </p>

      <div className="flex items-center gap-2">
        <Button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <span className="text-meta tabular-nums text-foreground-muted">
          Page {page} of {totalPages}
        </span>
        <Button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
