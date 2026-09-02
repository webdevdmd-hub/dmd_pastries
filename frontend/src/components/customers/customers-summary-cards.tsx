import { Ban, CalendarPlus, UserCheck, UsersRound } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { Customer } from "@/types/customer";

type SummaryItem = {
  label: string;
  value: number;
  icon: typeof UsersRound;
};

function isCurrentMonth(date: string): boolean {
  const parsedDate = new Date(date);
  const now = new Date();

  return parsedDate.getFullYear() === now.getFullYear() && parsedDate.getMonth() === now.getMonth();
}

export function CustomersSummaryCards({ customers }: { customers: Customer[] }): JSX.Element {
  const items: SummaryItem[] = [
    { label: "Total customers", value: customers.length, icon: UsersRound },
    {
      label: "Active customers",
      value: customers.filter((customer) => customer.status === "active").length,
      icon: UserCheck,
    },
    {
      label: "Blocked customers",
      value: customers.filter((customer) => customer.status === "blocked").length,
      icon: Ban,
    },
    {
      label: "New this month",
      value: customers.filter((customer) => isCurrentMonth(customer.createdAt)).length,
      icon: CalendarPlus,
    },
  ];

  return (
    // Two across on a phone, four from xl: four stacked cards filled a screen
    // before the first customer was visible.
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card className="bg-card/80" key={item.label}>
            <CardContent className="flex items-center justify-between gap-2 p-4 md:p-6">
              <div className="min-w-0">
                <p className="text-cell leading-tight text-brand-mocha">{item.label}</p>
                <p className="mt-2 text-kpi tabular-nums text-foreground">{item.value}</p>
              </div>
              <div className="hidden shrink-0 rounded-2xl bg-brand-cappuccino/35 p-3 text-brand-mocha sm:block">
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
