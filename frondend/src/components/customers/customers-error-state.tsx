import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CustomersErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function CustomersErrorState({
  description,
  onRetry,
}: CustomersErrorStateProps): JSX.Element {
  return (
    <Card className="border-red-200 bg-red-50/80">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-red-800" />
        <div>
          <h2 className="text-lg font-semibold text-brand-espresso">Unable to load customers</h2>
          <p className="mt-2 text-sm text-brand-mocha">{description}</p>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
