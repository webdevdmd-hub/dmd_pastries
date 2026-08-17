import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

export function ManufacturingReportErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="rounded-3xl border border-danger/30 bg-danger-tint p-5 text-danger-text">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <p className="font-semibold">Unable to load manufacturing report</p>
            <p className="text-sm">{description}</p>
          </div>
          <Button type="button" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
