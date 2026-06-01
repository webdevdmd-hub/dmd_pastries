import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductionOutput } from "@/types/manufacturing";

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not recorded";
}

export function BatchOutputSection({
  canManage,
  onProduce,
  outputs,
}: {
  canManage: boolean;
  onProduce: () => void;
  outputs: ProductionOutput[];
}): JSX.Element {
  return (
    <Card className="bg-white/85">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Production output</CardTitle>
        {canManage ? (
          <Button onClick={onProduce} type="button" variant="outline">
            Produce
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {outputs.length === 0 ? (
          <p className="text-sm text-brand-mocha">No output recorded yet.</p>
        ) : (
          outputs.map((output) => (
            <div
              className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 bg-brand-latte/40 p-4"
              key={output.id}
            >
              <div>
                <p className="font-semibold text-brand-espresso">
                  {output.quantityProduced} {output.unitName}
                </p>
                <p className="text-sm text-brand-mocha">{formatDate(output.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
