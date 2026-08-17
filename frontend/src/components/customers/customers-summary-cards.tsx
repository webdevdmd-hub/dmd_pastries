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
    { label: "Total Customers", value: customers.length, icon: UsersRound },
    {
      label: "Active Customers",
      value: customers.filter((customer) => customer.status === "active").length,
      icon: UserCheck,
    },
    {
      label: "Blocked Customers",
      value: customers.filter((customer) => customer.status === "blocked").length,
      icon: Ban,
    },
    {
      label: "New This Month",
      value: customers.filter((customer) => isCurrentMonth(customer.createdAt)).length,
      icon: CalendarPlus,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Card className="bg-card/80" key={item.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-brand-espresso">{item.value}</p>
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
