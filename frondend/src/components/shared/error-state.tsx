import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
}: ErrorStateProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-950 shadow-panel">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-red-900/80">{description}</p>
      {retryLabel && onRetry ? (
        <Button className="mt-5" onClick={onRetry} variant="outline">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
