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
    // One row at every width. Below md the row scrolls sideways rather than
    // wrapping: six cards over two or three lines pushed the first order off
    // the screen, and these are context for the list, not the list.
    <div className="scrollbar-hidden flex min-w-0 gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="w-36 shrink-0 md:w-auto md:min-w-0" key={card.key}>
            <CardContent className="flex items-center justify-between gap-2 p-4 lg:p-5">
              <div className="min-w-0">
                <p className="text-meta leading-tight text-foreground-muted">{card.label}</p>
                <p className="mt-1.5 break-words text-section font-medium tabular-nums text-foreground lg:text-kpi">
                  {summary?.[card.key] ?? 0}
                </p>
              </div>
              <span className="hidden shrink-0 rounded-lg bg-muted p-2.5 text-foreground-muted lg:inline-flex">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
