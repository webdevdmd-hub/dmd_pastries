"use client";

import type { JSX } from "react";

import {
  type TaxRateActionHandlers,
  TaxRateActionsMenu,
} from "@/components/settings/tax-rate-actions-menu";
import {
  formatTaxRate,
  taxInclusionLabel,
  TaxRateStatusBadge,
  taxRegionLabel,
} from "@/components/settings/tax-rate-shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaxRate } from "@/types/settings";

export type TaxRatesListProps = TaxRateActionHandlers & {
  /** Opens the rate's details; the whole row is the target. */
  onView: (taxRate: TaxRate) => void;
  taxRates: TaxRate[];
};

/**
 * Eight columns became five.
 *
 * "Inclusive" and "Default" were two whole columns answering Yes or No. Default
 * is now a badge beside the status, and inclusive reads as words -- "Included
 * in price" -- under the rate it changes the meaning of.
 */
export function TaxRatesTable({ onView, taxRates, ...actions }: TaxRatesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tax rate</TableHead>
          <TableHead className="text-right">Rate</TableHead>
          <TableHead>Applies in</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {taxRates.map((taxRate) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={taxRate.id} onClick={() => onView(taxRate)}>
            <TableCell>
              <button
                className="grid gap-0.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(taxRate);
                }}
                type="button"
              >
                <span className="font-medium">{taxRate.taxName}</span>
                <span className="text-meta text-foreground-muted">
                  {taxRate.taxType || "No type"} · {taxInclusionLabel(taxRate)}
                </span>
              </button>
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatTaxRate(taxRate.ratePercentage)}
            </TableCell>
            <TableCell>{taxRegionLabel(taxRate)}</TableCell>
            <TableCell>
              <TaxRateStatusBadge taxRate={taxRate} />
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <TaxRateActionsMenu {...actions} taxRate={taxRate} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
