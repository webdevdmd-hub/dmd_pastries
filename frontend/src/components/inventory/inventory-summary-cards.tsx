import { AlertTriangle, Boxes, CalendarClock, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { ExpiryBatch, InventoryItem } from "@/types/inventory";

type InventorySummaryCardsProps = {
  items: InventoryItem[];
  expiryAlerts?: ExpiryBatch[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

export function InventorySummaryCards({
  items,
  expiryAlerts = [],
}: InventorySummaryCardsProps): JSX.Element {
  const lowStockCount = items.filter((item) => item.lowStock).length;
  const totalStockValue = items.reduce((sum, item) => sum + item.inventoryValue, 0);
  const cards = [
    { label: "Total Inventory Items", value: items.length, icon: Boxes },
    { label: "Low Stock Items", value: lowStockCount, icon: AlertTriangle },
    { label: "Expiring Soon", value: expiryAlerts.length, icon: CalendarClock },
    { label: "Total Stock Value", value: formatMoney(totalStockValue), icon: WalletCards },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-brand-mocha">{card.label}</p>
              <p className="mt-2 text-3xl font-medium text-brand-espresso">{card.value}</p>
            </div>
            <div className="rounded-2xl bg-brand-cappuccino/35 p-3 text-brand-mocha">
              <card.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
