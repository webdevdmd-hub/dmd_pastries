import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Factory,
  PackageCheck,
  ReceiptText,
} from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { BakeryOrderSummary } from "@/types/orders";

const cards = [
  { key: "totalOrders", icon: ReceiptText, label: "Total Orders" },
  { key: "pendingOrders", icon: Clock, label: "Pending Orders" },
  { key: "inProductionOrders", icon: Factory, label: "In Production" },
  { key: "readyOrders", icon: PackageCheck, label: "Ready Orders" },
  { key: "completedOrders", icon: CheckCircle2, label: "Completed" },
  { key: "todayOrders", icon: CalendarClock, label: "Today Orders" },
] as const;

export function OrdersSummaryCards({
  summary,
}: {
  summary: BakeryOrderSummary | undefined;
}): JSX.Element {
  return (
    // Two across on a phone: six stacked cards filled two screens before the
    // first order was visible.
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="border-brand-cappuccino/60 bg-card/85" key={card.key}>
            <CardContent className="flex items-center justify-between gap-2 p-4 md:p-5">
              <div className="min-w-0">
                <p className="text-cell leading-tight text-brand-mocha">{card.label}</p>
                <p className="mt-2 text-kpi tabular-nums text-brand-espresso">
                  {summary?.[card.key] ?? 0}
                </p>
              </div>
              <span className="hidden shrink-0 rounded-2xl bg-brand-latte p-3 text-brand-mocha sm:inline-flex">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
