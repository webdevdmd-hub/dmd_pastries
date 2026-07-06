import { Banknote, CreditCard, Landmark, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { formatCurrency, formatNumber } from "@/components/reports/sales/sales-report-format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FinancialSummary } from "@/types/financial-reports";

export function FinancialSummaryCards({
  errorMessage,
  onRetry,
  summary,
}: {
  errorMessage?: string | undefined;
  onRetry?: (() => void) | undefined;
  summary: FinancialSummary | undefined;
}): JSX.Element {
  const warnings = summary?.consistencyWarnings ?? [];
  const shouldShowCards = !errorMessage || summary !== undefined;

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load financial summary</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorMessage}</span>
            {onRetry ? (
              <Button onClick={onRetry} size="sm" type="button" variant="outline">
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Accounting consistency warning</AlertTitle>
          <AlertDescription>
            {warnings
              .map(
                (warning) =>
                  `${String(warning.missingCount)} ${warning.sourceType}: ${warning.message}`,
              )
              .join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}
      {shouldShowCards ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportKpiCard
            icon={ReceiptText}
            label="Gross Sales"
            value={formatCurrency(summary?.grossSales ?? 0)}
          />
          <ReportKpiCard
            icon={WalletCards}
            label="Total Collected"
            value={formatCurrency(summary?.totalCollected ?? 0)}
          />
          <ReportKpiCard
            icon={RotateCcw}
            label="Total Refunded"
            value={formatCurrency(summary?.totalRefunded ?? 0)}
          />
          <ReportKpiCard
            icon={Landmark}
            label="Net Collected"
            value={formatCurrency(summary?.netCollected ?? 0)}
          />
          <ReportKpiCard
            icon={ReceiptText}
            label="Outstanding Balance"
            value={formatCurrency(summary?.outstandingCustomerBalance ?? 0)}
          />
          <ReportKpiCard
            icon={Landmark}
            label="Supplier Payables"
            value={formatCurrency(summary?.supplierPayableBalance ?? 0)}
          />
          <ReportKpiCard
            icon={Banknote}
            label="Cash Collected"
            value={formatCurrency(summary?.cashCollected ?? 0)}
          />
          <ReportKpiCard
            icon={CreditCard}
            label="Card Collected"
            value={formatCurrency(summary?.cardCollected ?? 0)}
          />
          <ReportKpiCard
            icon={WalletCards}
            label="Payments"
            value={formatNumber(summary?.paymentCount ?? 0)}
          />
          <ReportKpiCard
            icon={RotateCcw}
            label="Refunds"
            value={formatNumber(summary?.refundCount ?? 0)}
          />
        </div>
      ) : null}
    </div>
  );
}
