import type { Metadata } from "next";
import type { JSX } from "react";

import { ReconciliationReportPageClient } from "@/components/reports/financial/reconciliation-report-page-client";

export const metadata: Metadata = {
  title: "Reconciliation Report",
};

export default function ReconciliationReportPage(): JSX.Element {
  return <ReconciliationReportPageClient />;
}
