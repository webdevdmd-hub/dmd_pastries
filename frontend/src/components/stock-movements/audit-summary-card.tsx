import { Calculator, Scale } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { AuditResult } from "@/types/stock-movements";

type AuditSummaryCardProps = {
  audit: AuditResult;
};

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 3 }).format(value);
}

export function AuditSummaryCard({ audit }: AuditSummaryCardProps): JSX.Element {
  const cards = [
    { label: "Current Quantity", value: audit.currentQuantity, icon: Scale },
    {
      label: "Calculated Quantity",
      value: audit.calculatedQuantityFromMovements,
      icon: Calculator,
    },
    { label: "Total In", value: audit.totalIn, icon: Scale },
    { label: "Total Out", value: audit.totalOut, icon: Scale },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-foreground-muted">{card.label}</p>
              <p className="mt-2 text-3xl font-medium text-foreground">
                {formatQuantity(card.value)}
              </p>
            </div>
            <div className="rounded-2xl bg-border/35 p-3 text-foreground-muted">
              <card.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
