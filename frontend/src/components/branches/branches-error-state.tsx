import type { JSX } from "react";

import { ErrorState } from "@/components/shared/error-state";

type BranchesErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function BranchesErrorState({ description, onRetry }: BranchesErrorStateProps): JSX.Element {
  return (
    <ErrorState
      title="Unable to load branches"
      description={description}
      retryLabel="Retry"
      onRetry={onRetry}
    />
  );
}
