import { CheckCircle2, Circle, Factory, PackageCheck, Play } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductionBatch } from "@/types/manufacturing";

export function BatchTimeline({ batch }: { batch: ProductionBatch }): JSX.Element {
  const steps = [
    { done: true, icon: Circle, label: "Draft created" },
    { done: batch.status !== "draft", icon: Play, label: "Started" },
    {
      done: batch.producedQuantity > 0 || batch.status === "completed",
      icon: Factory,
      label: "Produced output",
    },
    { done: batch.status === "completed", icon: PackageCheck, label: "Completed" },
  ];

  return (
    <Card className="bg-white/85">
      <CardHeader>
        <CardTitle>Batch timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const Icon = step.done ? CheckCircle2 : step.icon;
          return (
            <div className="flex items-center gap-3" key={step.label}>
              <span
                className={
                  step.done
                    ? "rounded-full bg-green-50 p-2 text-green-800"
                    : "rounded-full bg-brand-latte p-2 text-brand-mocha"
                }
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-brand-espresso">{step.label}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
