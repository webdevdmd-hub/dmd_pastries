import { Banknote, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyPaymentSummary } from "@/types/payment";

type PaymentsSummaryCardsProps = {
  errorMessage?: string | undefined;
  onRetry?: (() => void) | undefined;
  summary: DailyPaymentSummary | undefined;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PaymentsSummaryCards({
  errorMessage,
  onRetry,
  summary,
}: PaymentsSummaryCardsProps): JSX.Element {
  const warnings = summary?.consistencyWarnings ?? [];
  const shouldShowCards = !errorMessage || summary !== undefined;
  const cards = [
    {
      label: "Total Collected",
      value: formatMoney(summary?.totalCollected ?? 0),
      detail: `POS ${formatMoney(summary?.posCollected ?? 0)} / Bakery ${formatMoney(summary?.bakeryCollected ?? 0)}`,
      icon: Banknote,
    },
    {
      label: "Total Refunded",
      value: formatMoney(summary?.totalRefunded ?? 0),
      detail: "POS refunds",
      icon: RotateCcw,
    },
    {
      label: "Net Collected",
      value: formatMoney(summary?.netCollected ?? 0),
      detail: "Collected minus refunds",
      icon: WalletCards,
    },
    {
      label: "Transactions",
      value: String(summary?.transactionsCount ?? 0),
      detail: `Deposit / Advance ${formatMoney(summary?.depositCollected ?? 0)} / Balance ${formatMoney(summary?.balanceCollected ?? 0)} / Final Settlement ${formatMoney(summary?.fullCollected ?? 0)}`,
      icon: ReceiptText,
    },
  ];

  return (
    <div className="space-y-4">
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
      {shouldShowCards ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Card className="bg-card/80" key={card.label}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-brand-mocha">{card.label}</p>
                    <p className="mt-2 text-2xl font-medium text-brand-espresso">{card.value}</p>
                    <p className="mt-1 text-xs text-brand-mocha">{card.detail}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-cappuccino/40 text-brand-mocha">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
