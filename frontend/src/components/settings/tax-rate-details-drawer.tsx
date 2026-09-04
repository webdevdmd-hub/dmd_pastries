"use client";

import { Pencil } from "lucide-react";
import type { JSX, ReactNode } from "react";

import {
  formatTaxRate,
  taxInclusionLabel,
  TaxRateStatusBadge,
  taxRegionLabel,
} from "@/components/settings/tax-rate-shared";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TaxRate } from "@/types/settings";

function InfoField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <div className="mt-0.5 break-words text-cell font-medium">{value}</div>
    </div>
  );
}

type TaxRateDetailsDrawerProps = {
  canManage: boolean;
  /** Closes the drawer, then opens the host's form dialog. */
  onEdit: (taxRate: TaxRate) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  taxRate: TaxRate | null;
};

/**
 * One rate, over the list.
 *
 * No tabs: a tax rate has six attributes. The point here is that a rate can
 * be read at all -- the only way in was its editor.
 */
export function TaxRateDetailsDrawer({
  canManage,
  onEdit,
  onOpenChange,
  open,
  taxRate,
}: TaxRateDetailsDrawerProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" side="right">
        {taxRate ? (
          <div className="grid min-w-0 gap-6" key={taxRate.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{taxRate.taxName}</SheetTitle>
              <SheetDescription className="sr-only">
                Tax rate details and where it applies.
              </SheetDescription>
              <p className="mt-1 text-section font-medium tabular-nums">
                {formatTaxRate(taxRate.ratePercentage)}
              </p>
              <div className="mt-2">
                <TaxRateStatusBadge taxRate={taxRate} />
              </div>
              {canManage ? (
                <div className="mt-3">
                  <Button onClick={() => onEdit(taxRate)} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit tax rate
                  </Button>
                </div>
              ) : null}
            </SheetHeader>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Tax type" value={taxRate.taxType || "Not set"} />
              <InfoField label="Applies in" value={taxRegionLabel(taxRate)} />
              <InfoField label="Price treatment" value={taxInclusionLabel(taxRate)} />
              <InfoField
                label="Default rate"
                value={taxRate.isDefault ? "Yes, used unless overridden" : "No"}
              />
            </div>

            {/* Inclusive against exclusive changes what a printed total means,
                and it is the field most often set wrong. */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-cell font-medium">
                {taxRate.isInclusive ? "Included in the price" : "Added to the price"}
              </p>
              <p className="mt-1 text-cell text-foreground-muted">
                {taxRate.isInclusive
                  ? `A ${formatTaxRate(taxRate.ratePercentage)} inclusive rate means the price already contains the tax, and the tax is worked back out of it.`
                  : `A ${formatTaxRate(taxRate.ratePercentage)} exclusive rate is added on top of the price at checkout.`}
              </p>
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Tax rate</SheetTitle>
            <SheetDescription>No tax rate selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
