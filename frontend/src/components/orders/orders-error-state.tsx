import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function OrdersErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <AlertTriangle className="h-10 w-10 text-danger-text" />
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">Unable to load orders</h2>
          <p className="mt-2 text-sm text-brand-mocha">{description}</p>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
