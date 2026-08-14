"use client";

import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ReportConsistencyWarning } from "@/types/financial-reports";

/**
 * Drift warnings and ledger provenance for a report whose headline figure is
 * read from the accounting ledger.
 *
 * The receivables and payables reports both need this, and the financial
 * summary renders the same thing inline.
 */
export function ReportLedgerNotice({
  sourceOfTruth,
  warnings,
}: {
  sourceOfTruth: string;
  warnings: ReportConsistencyWarning[];
}): JSX.Element | null {
  if (warnings.length === 0 && sourceOfTruth !== "journal_entries") return null;
  return (
    <div className="space-y-4">
      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Accounting consistency warning</AlertTitle>
          <AlertDescription>
            {warnings
              .map((warning) =>
                // Drift warnings carry no missing count — their message
                // already names both figures.
                warning.missingCount > 0
                  ? `${String(warning.missingCount)} ${warning.sourceType}: ${warning.message}`
                  : warning.message,
              )
              .join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}
      {sourceOfTruth === "journal_entries" ? (
        <p className="text-xs text-muted-foreground">
          The balance above is read from the accounting ledger as of the report end date, and
          cross-checked against the operational records. It covers every open document, so it
          will not match the sum of the rows below when the date filter excludes older ones.
        </p>
      ) : null}
    </div>
  );
}
