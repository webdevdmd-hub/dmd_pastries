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
    // One row at every width; below sm it scrolls sideways rather than
    // wrapping to a second line.
    <div className="scrollbar-hidden flex min-w-0 gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card className="w-40 shrink-0 sm:w-auto sm:min-w-0" key={item.label}>
            <CardContent className="flex items-center justify-between gap-2 p-4 lg:p-5">
              <div className="min-w-0">
                <p className="text-meta leading-tight text-foreground-muted">{item.label}</p>
                <p className="mt-1.5 break-words text-section font-medium tabular-nums text-foreground lg:text-kpi">
                  {item.value}
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
