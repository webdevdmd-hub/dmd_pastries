import { Factory } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ManufacturingEmptyState({
  actionLabel,
  description = "Create production from an active recipe. The backend will handle component consumption, finished output, costing, and accounting.",
  onAction,
  title = "No production records found.",
}: {
  actionLabel?: string | undefined;
  description?: string;
  onAction?: (() => void) | undefined;
  title?: string;
}): JSX.Element {
  return (
    <Card className="border-brand-cappuccino/70 bg-card/80">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-2xl bg-brand-latte p-4 text-brand-mocha">
          <Factory className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-brand-espresso">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-mocha">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction} type="button">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
