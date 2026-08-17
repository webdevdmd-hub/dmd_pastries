import { Banknote, CreditCard, Landmark, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { PaymentMethodSummary } from "@/types/payment";

type PaymentMethodSummaryCardsProps = {
  summaries: PaymentMethodSummary[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function iconForMethod(methodName: string): typeof Banknote {
  const normalized = methodName.toLowerCase();

  if (normalized.includes("card")) return CreditCard;
  if (normalized.includes("bank") || normalized.includes("transfer")) return Landmark;
  if (normalized.includes("cash")) return Banknote;

  return WalletCards;
}

export function PaymentMethodSummaryCards({
  summaries,
}: PaymentMethodSummaryCardsProps): JSX.Element {
  const visibleSummaries =
    summaries.length > 0
      ? summaries
      : [
          {
            paymentMethodId: "cash",
            paymentMethodName: "Cash",
            collectedAmount: 0,
            refundedAmount: 0,
            netAmount: 0,
            totalAmount: 0,
            transactionsCount: 0,
            grossTransactionCount: 0,
            refundTransactionCount: 0,
            netTransactionCount: 0,
          },
          {
            paymentMethodId: "card",
            paymentMethodName: "Card",
            collectedAmount: 0,
            refundedAmount: 0,
            netAmount: 0,
            totalAmount: 0,
            transactionsCount: 0,
            grossTransactionCount: 0,
            refundTransactionCount: 0,
            netTransactionCount: 0,
          },
          {
            paymentMethodId: "bank-transfer",
            paymentMethodName: "Bank Transfer",
            collectedAmount: 0,
            refundedAmount: 0,
            netAmount: 0,
            totalAmount: 0,
            transactionsCount: 0,
            grossTransactionCount: 0,
            refundTransactionCount: 0,
            netTransactionCount: 0,
          },
        ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-brand-mocha">Collection by method</h2>
        <p className="mt-1 text-sm text-brand-mocha">
          Backend-calculated method totals after refunds.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleSummaries.map((summary) => {
          const Icon = iconForMethod(summary.paymentMethodName);

          return (
            <Card className="bg-card/80" key={summary.paymentMethodId}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-espresso">
                      {summary.paymentMethodName}
                    </p>
                    <div className="mt-1 grid gap-1 text-xs text-brand-mocha">
                      <span>Gross Transactions: {summary.grossTransactionCount}</span>
                      <span>Refund Transactions: {summary.refundTransactionCount}</span>
                      <span>Net Transactions: {summary.netTransactionCount}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-brand-cappuccino/40 p-3 text-brand-mocha">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-medium text-brand-espresso">
                    {formatMoney(summary.netAmount)}
                  </p>
                  <p className="text-xs text-brand-mocha">
                    Collected {formatMoney(summary.collectedAmount)} · Refunded{" "}
                    {formatMoney(summary.refundedAmount)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
