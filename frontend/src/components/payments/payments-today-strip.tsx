"use client";

import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { DailyPaymentSummary, PaymentMethodSummary } from "@/types/payment";

type PaymentsTodayStripProps = {
  errorMessage?: string | undefined;
  methodSummaries: PaymentMethodSummary[];
  onRetry?: (() => void) | undefined;
  summary: DailyPaymentSummary | undefined;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function Figure({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The day's totals as one row.
 *
 * This replaces seven cards — four KPI tiles and three per-method tiles — that
 * pushed the payments table 2207px down the page and rendered seventeen
 * currency values of which exactly one was distinct. A cashier opening this
 * screen wants the ledger, not a dashboard.
 *
 * Nothing is dropped. Every figure the cards showed is still here: the headline
 * numbers inline, the rest behind "View full summary". Both summary endpoints
 * are still called by the page — this only changes how their data is drawn.
 *
 * The two alerts stay above the strip and never collapse: an accounting
 * consistency warning is exactly the thing that must not be one click away.
 */
export function PaymentsTodayStrip({
  errorMessage,
  methodSummaries,
  onRetry,
  summary,
}: PaymentsTodayStripProps): JSX.Element {
  const [showDetail, setShowDetail] = useState(false);
  const warnings = summary?.consistencyWarnings ?? [];

  return (
    <div className="flex flex-col gap-3">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load payment summary</AlertTitle>
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

      <div className="rounded bg-muted px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <div className="flex items-baseline gap-2.5">
            <span className="text-meta text-foreground-muted">Net collected today</span>
            <span className="text-kpi tabular-nums">{formatMoney(summary?.netCollected ?? 0)}</span>
          </div>

          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />

          <Figure label="Payments" value={String(summary?.transactionsCount ?? 0)} />
          {methodSummaries.map((method) => (
            <Figure
              key={method.paymentMethodId}
              label={method.paymentMethodName}
              value={formatMoney(method.netAmount)}
            />
          ))}

          <Button
            aria-expanded={showDetail}
            className="ml-auto"
            onClick={() => setShowDetail((open) => !open)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {showDetail ? "Hide full summary" : "View full summary"}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-transform duration-fast ease-out",
                showDetail && "rotate-180",
              )}
            />
          </Button>
        </div>

        {showDetail ? (
          <div className="mt-3 grid gap-x-8 gap-y-2 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-3">
            <Figure label="Total collected" value={formatMoney(summary?.totalCollected ?? 0)} />
            <Figure label="From POS" value={formatMoney(summary?.posCollected ?? 0)} />
            <Figure label="From bakery orders" value={formatMoney(summary?.bakeryCollected ?? 0)} />
            <Figure label="Total refunded" value={formatMoney(summary?.totalRefunded ?? 0)} />
            <Figure label="Deposit / advance" value={formatMoney(summary?.depositCollected ?? 0)} />
            <Figure label="Balance" value={formatMoney(summary?.balanceCollected ?? 0)} />
            <Figure label="Final settlement" value={formatMoney(summary?.fullCollected ?? 0)} />

            {methodSummaries.map((method) => (
              <Figure
                key={`${method.paymentMethodId}-detail`}
                label={`${method.paymentMethodName} — collected / refunded`}
                value={`${formatMoney(method.collectedAmount)} / ${formatMoney(method.refundedAmount)}`}
              />
            ))}
            {methodSummaries.map((method) => (
              <Figure
                key={`${method.paymentMethodId}-count`}
                label={`${method.paymentMethodName} — transactions`}
                value={`${String(method.grossTransactionCount)} gross / ${String(method.refundTransactionCount)} refund`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
