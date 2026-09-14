import { Banknote, CalendarClock, Clock3, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { CustomerStats } from "@/types/customer";

function currency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

/**
 * A customer's totals, or an honest statement that they could not be loaded.
 *
 * Every figure here used to fall back to `?? 0`, so a stats request that
 * failed rendered as "Total Sales AED 0.00 … Last Purchase Never" -- which is
 * exactly what a real customer who has never bought anything looks like. That
 * is how ISSUE-011 survived: the endpoint was returning 500 for every customer
 * on every request and the screen calmly reported zero.
 *
 * A zero is now only shown when a figure was actually received. If the request
 * failed, this says so instead of inventing a number.
 *
 * Regression: ISSUE-011 — customer statistics returned 500 for every customer
 * Found by /qa on 2026-09-14
 */
export function CustomerStatsCards({
  creditBalance,
  error,
  stats,
}: {
  creditBalance?: number;
  error?: Error | null;
  stats: CustomerStats | undefined;
}): JSX.Element {
  if (error) {
    return (
      <Card className="border-danger/30 bg-danger-tint">
        <CardContent className="p-5">
          <p className="text-cell font-medium text-danger-text">
            This customer&apos;s totals could not be loaded.
          </p>
          <p className="mt-1 text-cell text-danger-text">
            Sales, payments and balances are unavailable right now, so nothing is shown rather than
            a figure that might be wrong. Everything else on this page is unaffected.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { label: "Total Sales", value: currency(stats?.totalSalesAmount ?? 0), icon: Banknote },
    {
      label: "Bakery Orders",
      value: currency(stats?.bakeryOrdersAmount ?? 0),
      detail: `${String(stats?.bakeryOrdersCount ?? 0)} orders`,
      icon: ReceiptText,
    },
    { label: "Total Paid", value: currency(stats?.totalPaidAmount ?? 0), icon: WalletCards },
    {
      label: "Outstanding Balance",
      value: currency(stats?.outstandingBalance ?? 0),
      icon: Banknote,
    },
    {
      label: "Last Purchase",
      value: stats?.lastPurchaseAt
        ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(
            new Date(stats.lastPurchaseAt),
          )
        : "Never",
      icon: CalendarClock,
    },
    {
      label: "Last Bakery Order",
      value: stats?.lastOrderAt
        ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(
            new Date(stats.lastOrderAt),
          )
        : "Never",
      icon: CalendarClock,
    },
    {
      label: "Pending Payments",
      value: String(stats?.pendingPayments ?? 0),
      detail: `${String(stats?.totalOrdersCount ?? 0)} total transactions`,
      icon: Clock3,
    },
    {
      label: "Refunds",
      value: currency(stats?.totalRefundedAmount ?? 0),
      icon: RotateCcw,
    },
    {
      label: "Store Credit",
      value: currency(creditBalance ?? 0),
      detail: "Redeemable at POS checkout",
      icon: WalletCards,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card className="bg-card/80" key={card.label}>
            <CardContent className="flex items-center justify-between gap-2 p-4 md:p-5">
              <div className="min-w-0">
                <p className="text-cell leading-tight text-brand-mocha">{card.label}</p>
                <p className="mt-2 break-words text-title tabular-nums text-brand-espresso">
                  {card.value}
                </p>
                {"detail" in card && card.detail ? (
                  <p className="mt-1 text-xs text-brand-mocha">{card.detail}</p>
                ) : null}
              </div>
              <Icon className="hidden h-6 w-6 shrink-0 text-brand-mocha sm:block" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
