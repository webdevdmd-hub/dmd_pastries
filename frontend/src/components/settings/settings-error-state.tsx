import type { JSX } from "react";

import { ErrorState } from "@/components/shared/error-state";

type SettingsErrorStateProps = {
  description: string;
  onRetry?: () => void;
};

export function SettingsErrorState({ description, onRetry }: SettingsErrorStateProps): JSX.Element {
  const errorStateProps = {
    title: "Unable to load settings",
    description,
    retryLabel: "Retry",
    ...(onRetry ? { onRetry } : {}),
  };

  return <ErrorState {...errorStateProps} />;
}
