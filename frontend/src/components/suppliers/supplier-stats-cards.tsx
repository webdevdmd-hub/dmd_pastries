"use client";

import {
  CalendarClock,
  ClipboardList,
  FileText,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { SupplierStats } from "@/types/supplier";

type SupplierStatsCardsProps = {
  stats: SupplierStats | undefined;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "No purchases";
}

export function SupplierStatsCards({ stats }: SupplierStatsCardsProps): JSX.Element {
  const cards = [
    {
      label: "Purchase Orders",
      value: String(stats?.totalPurchaseOrders ?? 0),
      icon: ClipboardList,
    },
    {
      label: "Bills",
      value: String(stats?.totalBills ?? 0),
      icon: ReceiptText,
    },
    {
      label: "Purchase Amount",
      value: formatCurrency(stats?.totalPurchaseAmount ?? 0),
      icon: WalletCards,
    },
    {
      label: "Paid",
      value: formatCurrency(stats?.totalPaidAmount ?? 0),
      icon: FileText,
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats?.outstandingBalance ?? 0),
      icon: Scale,
    },
    {
      label: "Last Purchase",
      value: formatDate(stats?.lastPurchaseDate ?? null),
      icon: CalendarClock,
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
                <p className="mt-2 text-2xl font-black text-brand-espresso">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-cappuccino/35 p-3 text-brand-mocha">
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
