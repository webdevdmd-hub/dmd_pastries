import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

type IngredientsErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function IngredientsErrorState({
  description,
  onRetry,
}: IngredientsErrorStateProps): JSX.Element {
  return (
    <div className="grid place-items-center rounded-3xl border border-danger/30 bg-danger-tint/70 p-12 text-center">
      <div className="grid max-w-md gap-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-danger-text" />
        <h2 className="text-2xl font-bold text-brand-espresso">Unable to load ingredients</h2>
        <p className="text-brand-mocha">{description}</p>
        <Button className="mx-auto" onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </div>
    </div>
  );
}
