import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InventoryErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function InventoryErrorState({
  description,
  onRetry,
}: InventoryErrorStateProps): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint/70">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-danger-text" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-brand-espresso">Unable to load inventory</h2>
          <p className="max-w-lg text-sm text-brand-mocha">{description}</p>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
