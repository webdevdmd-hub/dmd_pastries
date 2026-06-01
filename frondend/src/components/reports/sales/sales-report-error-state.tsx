import type { JSX } from "react";

import { ReportErrorState } from "@/components/reports/report-error-state";

export function SalesReportErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry: () => void;
}): JSX.Element {
  return <ReportErrorState description={description} onRetry={onRetry} />;
}
