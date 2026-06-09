import type { JSX } from "react";

import {
  AccountingJournalLink,
  StockMovementLink,
} from "@/components/shared/accounting-reference-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductionWastage } from "@/types/manufacturing";
import { PRODUCT_TYPE_LABELS } from "@/types/product";

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    style: "currency",
  }).format(value);
}

function wastageName(item: ProductionWastage): string {
  return item.componentProductName ?? item.itemName;
}

function wastageMeta(item: ProductionWastage): string {
  const parts = [
    item.componentProductType ? PRODUCT_TYPE_LABELS[item.componentProductType] : "Legacy item",
    item.componentVariantName,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
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
            <div
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4"
              key={item.id}
            >
              <div>
                <p className="font-semibold text-brand-espresso">{wastageName(item)}</p>
                <p className="text-xs text-brand-mocha">{wastageMeta(item)}</p>
                <p className="text-sm text-brand-mocha">
                  {item.quantity} {item.unitName} / {item.wastageType} / {item.reason}
                </p>
                <p className="mt-1 text-xs text-brand-mocha">{formatDate(item.createdAt)}</p>
                {item.totalCost > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-brand-espresso">
                    Cost {formatMoney(item.totalCost)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StockMovementLink id={item.stockMovementId} />
                <AccountingJournalLink id={item.accountingJournalEntryId} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
