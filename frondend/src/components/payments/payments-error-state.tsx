import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PaymentsErrorStateProps = {
  description: string;
  onRetry: () => void;
  title?: string;
};

export function PaymentsErrorState({
  description,
  onRetry,
  title = "Unable to load payments",
}: PaymentsErrorStateProps): JSX.Element {
  return (
    <Card className="border-red-200 bg-red-50/60">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-800">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-brand-espresso">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-red-900">{description}</p>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
