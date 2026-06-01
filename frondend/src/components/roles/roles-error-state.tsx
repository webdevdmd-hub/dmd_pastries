import type { JSX } from "react";

import { ErrorState } from "@/components/shared/error-state";

type RolesErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function RolesErrorState({ description, onRetry }: RolesErrorStateProps): JSX.Element {
  return (
    <ErrorState
      title="Unable to load roles"
      description={description}
      retryLabel="Retry roles request"
      onRetry={onRetry}
    />
  );
}
