import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DashboardQuickAction = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export function DashboardQuickActions({
  actions,
}: {
  actions: DashboardQuickAction[];
}): JSX.Element {
  return (
    <Card className="bg-white/85 shadow-soft">
      <CardHeader>
        <CardTitle className="text-brand-espresso">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 font-semibold text-brand-espresso transition hover:-translate-y-0.5 hover:bg-brand-cappuccino/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel"
              href={action.href}
              key={action.href}
            >
              <Icon className="h-5 w-5 text-brand-mocha" aria-hidden="true" />
              {action.label}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
