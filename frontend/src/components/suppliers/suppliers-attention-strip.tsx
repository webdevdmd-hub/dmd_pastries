"use client";

import type { JSX } from "react";

import type { Supplier, SupplierStatus } from "@/types/supplier";

type SuppliersAttentionStripProps = {
  suppliers: Supplier[];
  /** Server-side total for the filter; may exceed `suppliers.length`. */
  total: number;
  onFilterStatus: (status: SupplierStatus) => void;
  /** Narrows the list to suppliers a PO cannot be costed against yet. */
  onFilterMissingTerms: () => void;
};

/**
 * Replaces the four KPI cards.
 *
 * The cards restated the table directly below them, and their counts did not
 * reconcile: there was an Active card and a Blocked card but no Inactive one,
 * so deactivating a supplier removed it from every breakdown while Total still
 * counted it. The fourth card spent a full panel on "Supplier Countries",
 * which reads 0 for any tenant that has not filled in a country.
 *
 * What replaces them is one line of plain text plus chips that appear ONLY when
 * they are actionable, and each chip is a filter -- the count and the way to
 * act on it are the same control.
 */
export function SuppliersAttentionStrip({
  suppliers,
  total,
  onFilterStatus,
  onFilterMissingTerms,
}: SuppliersAttentionStripProps): JSX.Element {
  const active = suppliers.filter((supplier) => supplier.status === "active").length;
  const inactive = suppliers.filter((supplier) => supplier.status === "inactive").length;
  const blocked = suppliers.filter((supplier) => supplier.status === "blocked").length;
  // Only suppliers you might actually order from: a blocked supplier with no
  // terms is not a gap worth chasing.
  const missingTerms = suppliers.filter(
    (supplier) => supplier.status !== "blocked" && supplier.paymentTerms === "",
  ).length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3">
      <p className="text-cell tabular-nums">
        <span className="font-medium">
          {total} {total === 1 ? "supplier" : "suppliers"}
        </span>
        <span className="text-foreground-muted"> · {active} active</span>
      </p>

      <div className="ms-auto flex flex-wrap items-center gap-2">
        {missingTerms > 0 ? (
          <button
            className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-warning-tint px-2.5 text-meta font-medium tabular-nums text-warning-text transition-colors hover:brightness-[0.97]"
            onClick={onFilterMissingTerms}
            type="button"
          >
            <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
            {missingTerms} missing terms
          </button>
        ) : null}
        {inactive > 0 ? (
          <button
            className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-card px-2.5 text-meta font-medium tabular-nums text-foreground-muted transition-colors hover:bg-card/70"
            onClick={() => onFilterStatus("inactive")}
            type="button"
          >
            <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
            {inactive} inactive
          </button>
        ) : null}
        {blocked > 0 ? (
          <button
            className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-danger-tint px-2.5 text-meta font-medium tabular-nums text-danger-text transition-colors hover:brightness-[0.97]"
            onClick={() => onFilterStatus("blocked")}
            type="button"
          >
            <span aria-hidden="true" className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
            {blocked} blocked
          </button>
        ) : null}
      </div>
    </div>
  );
}
