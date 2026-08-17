"use client";

import { Ban, MapPin, Truck, UserCheck } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { Supplier } from "@/types/supplier";

type SuppliersSummaryCardsProps = {
  suppliers: Supplier[];
};

export function SuppliersSummaryCards({ suppliers }: SuppliersSummaryCardsProps): JSX.Element {
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === "active").length;
  const blockedSuppliers = suppliers.filter((supplier) => supplier.status === "blocked").length;
  const countries = new Set(
    suppliers
      .map((supplier) => supplier.country)
      .filter((country): country is string => typeof country === "string" && country.length > 0),
  ).size;
  const cards = [
    { label: "Total Suppliers", value: suppliers.length, icon: Truck },
    { label: "Active Suppliers", value: activeSuppliers, icon: UserCheck },
    { label: "Blocked Suppliers", value: blockedSuppliers, icon: Ban },
    { label: "Supplier Countries", value: countries, icon: MapPin },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card className="bg-card/80" key={card.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-4xl font-medium text-brand-espresso">{card.value}</p>
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
