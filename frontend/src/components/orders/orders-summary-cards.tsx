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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="border-brand-cappuccino/60 bg-white/85" key={card.key}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-brand-espresso">
                  {summary?.[card.key] ?? 0}
                </p>
              </div>
              <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
