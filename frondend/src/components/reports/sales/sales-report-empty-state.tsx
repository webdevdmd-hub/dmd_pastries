import type { JSX } from "react";

import { ReportEmptyState } from "@/components/reports/report-empty-state";

export function SalesReportEmptyState({ message }: { message: string }): JSX.Element {
  return <ReportEmptyState message={message} />;
}
