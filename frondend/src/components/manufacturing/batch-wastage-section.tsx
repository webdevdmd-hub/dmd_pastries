import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductionWastage } from "@/types/manufacturing";

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

export function BatchWastageSection({
  canManage,
  onAddWastage,
  wastage,
}: {
  canManage: boolean;
  onAddWastage: () => void;
  wastage: ProductionWastage[];
}): JSX.Element {
  return (
    <Card className="bg-white/85">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Wastage</CardTitle>
        {canManage ? (
          <Button onClick={onAddWastage} type="button" variant="outline">
            Add wastage
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {wastage.length === 0 ? (
          <p className="text-sm text-brand-mocha">No wastage recorded yet.</p>
        ) : (
          wastage.map((item) => (
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4" key={item.id}>
              <p className="font-semibold text-brand-espresso">{item.itemName}</p>
              <p className="text-sm text-brand-mocha">
                {item.quantity} {item.unitName} · {item.wastageType} · {item.reason}
              </p>
              <p className="mt-1 text-xs text-brand-mocha">{formatDate(item.createdAt)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
