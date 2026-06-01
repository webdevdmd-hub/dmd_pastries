"use client";

import { AlertTriangle, Boxes, PackageCheck, PackageOpen } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { PackagingItem } from "@/types/packaging";

export function PackagingSummaryCards({ items }: { items: PackagingItem[] }): JSX.Element {
  const active = items.filter((item) => item.status === "active").length;
  const tracked = items.filter((item) => item.isStockTracked).length;
  const cards = [
    { label: "Total Packaging Items", value: items.length, icon: Boxes },
    { label: "Active Packaging", value: active, icon: PackageCheck },
    { label: "Stock Tracked Items", value: tracked, icon: PackageOpen },
    { label: "Low Stock Packaging", value: 0, icon: AlertTriangle },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card className="bg-white/80" key={card.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-4xl font-black text-brand-espresso">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-cappuccino/35 p-4 text-brand-mocha">
                <Icon className="h-7 w-7" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
