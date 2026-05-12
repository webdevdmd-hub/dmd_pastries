"use client";

import { Ban, FolderTree, Truck, UserCheck } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { Supplier, SupplierCategory } from "@/types/supplier";

type SuppliersSummaryCardsProps = {
  categories: SupplierCategory[];
  suppliers: Supplier[];
};

export function SuppliersSummaryCards({
  categories,
  suppliers,
}: SuppliersSummaryCardsProps): JSX.Element {
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
  const blockedSuppliers = suppliers.filter((supplier) => supplier.status === "blocked").length;
  const cards = [
    { label: "Total Suppliers", value: suppliers.length, icon: Truck },
    { label: "Active Suppliers", value: activeSuppliers, icon: UserCheck },
    { label: "Blocked Suppliers", value: blockedSuppliers, icon: Ban },
    { label: "Supplier Categories", value: categories.length, icon: FolderTree },
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
