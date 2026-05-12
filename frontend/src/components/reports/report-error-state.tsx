import type { JSX } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";

type ReportErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function ReportErrorState({ description, onRetry }: ReportErrorStateProps): JSX.Element {
  return (
    <div className="space-y-3">
      <ErrorState title="Unable to load reports" description={description} />
      <Button type="button" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
