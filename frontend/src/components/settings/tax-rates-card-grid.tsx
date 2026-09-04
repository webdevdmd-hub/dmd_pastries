"use client";

import type { JSX } from "react";

import { TaxRateActionsMenu } from "@/components/settings/tax-rate-actions-menu";
import {
  formatTaxRate,
  taxInclusionLabel,
  TaxRateStatusBadge,
  taxRegionLabel,
} from "@/components/settings/tax-rate-shared";
import type { TaxRatesListProps } from "@/components/settings/tax-rates-table";
import { Card } from "@/components/ui/card";

/** Tax rates as cards, for phones. */
export function TaxRatesCardGrid({ onView, taxRates, ...actions }: TaxRatesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {taxRates.map((taxRate) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={taxRate.id}
          onClick={() => onView(taxRate)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-1.5">
              <button
                className="truncate rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(taxRate);
                }}
                type="button"
              >
                {taxRate.taxName}
              </button>
              <TaxRateStatusBadge taxRate={taxRate} />
            </div>
            <div onClick={(event) => event.stopPropagation()}>
              <TaxRateActionsMenu {...actions} taxRate={taxRate} />
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-section font-medium tabular-nums">
              {formatTaxRate(taxRate.ratePercentage)}
            </span>
            <span className="text-cell text-foreground-muted">{taxInclusionLabel(taxRate)}</span>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Tax type</p>
              <p className="mt-1 break-words text-cell font-medium">
                {taxRate.taxType || "Not set"}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Applies in</p>
              <p className="mt-1 break-words text-cell font-medium">{taxRegionLabel(taxRate)}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
