import { RotateCcw } from "lucide-react";
import type { JSX } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";

type UsersErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function UsersErrorState({ description, onRetry }: UsersErrorStateProps): JSX.Element {
  return (
    <div className="space-y-5">
      <ErrorState title="Unable to load staff users" description={description} />
      <div className="flex justify-center">
        <Button onClick={onRetry} variant="outline">
          <RotateCcw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}
