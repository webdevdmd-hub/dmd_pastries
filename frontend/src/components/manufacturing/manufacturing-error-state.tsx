import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ManufacturingErrorState({
  description,
  onRetry,
  title = "Unable to load manufacturing data",
}: {
  description: string;
  onRetry: () => void;
  title?: string;
}): JSX.Element {
  return (
    <Card className="border-red-200 bg-red-50/70">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-red-800" />
        <div>
          <h2 className="text-2xl font-semibold text-brand-espresso">{title}</h2>
          <p className="mt-2 text-sm text-brand-mocha">{description}</p>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
