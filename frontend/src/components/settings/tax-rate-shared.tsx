"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { TaxRate } from "@/types/settings";

export function formatTaxRate(rate: number): string {
  return `${String(rate)}%`;
}

export function taxRegionLabel(taxRate: TaxRate): string {
  const country = taxRate.country.trim();
  const region = taxRate.region.trim();

  if (country.length === 0 && region.length === 0) {
    return "Not set";
  }

  return region.length > 0 ? `${country} - ${region}` : country;
}

/**
 * How the rate relates to the price it is quoted with. "Inclusive" and
 * "exclusive" are the words an accountant uses; the table used to answer
 * "Inclusive: Yes / No" down a whole column instead.
 */
export function taxInclusionLabel(taxRate: TaxRate): string {
  return taxRate.isInclusive ? "Included in price" : "Added to price";
}

export function TaxRateStatusBadge({ taxRate }: { taxRate: TaxRate }): JSX.Element {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge className="capitalize" variant={taxRate.status === "active" ? "secondary" : "default"}>
        {taxRate.status}
      </Badge>
      {taxRate.isDefault ? <Badge>Default</Badge> : null}
    </span>
  );
}
