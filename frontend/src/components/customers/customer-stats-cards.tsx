import {
  Banknote,
  CalendarClock,
  Clock3,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { CustomerStats } from "@/types/customer";

function currency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function CustomerStatsCards({ stats }: { stats: CustomerStats | undefined }): JSX.Element {
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
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card className="bg-white/80" key={card.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-2 text-xl font-semibold text-brand-espresso">{card.value}</p>
                {"detail" in card && card.detail ? (
                  <p className="mt-1 text-xs text-brand-mocha">{card.detail}</p>
                ) : null}
              </div>
              <Icon className="h-6 w-6 text-brand-mocha" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
