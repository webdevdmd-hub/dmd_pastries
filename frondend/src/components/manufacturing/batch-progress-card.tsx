import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchProgressCard({ batch }: { batch: ProductionBatch }): JSX.Element {
  const progress =
    batch.plannedQuantity > 0
      ? Math.min((batch.producedQuantity / batch.plannedQuantity) * 100, 100)
      : 0;
  const remaining = Math.max(batch.plannedQuantity - batch.producedQuantity, 0);

  return (
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>Production progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-3 rounded-full bg-brand-latte">
          <div
            className="h-3 rounded-full bg-brand-caramel"
            style={{ width: `${progress.toFixed(0)}%` }}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-sm text-brand-mocha">Planned</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {batch.plannedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div>
            <p className="text-sm text-brand-mocha">Produced</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {batch.producedQuantity} {batch.batchUnitName}
            </p>
          </div>
          <div>
            <p className="text-sm text-brand-mocha">Remaining</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {remaining} {batch.batchUnitName}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
