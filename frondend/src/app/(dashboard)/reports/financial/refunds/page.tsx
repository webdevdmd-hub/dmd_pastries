import type { Metadata } from "next";
import type { JSX } from "react";

import { RefundsReportPageClient } from "@/components/reports/financial/refunds-report-page-client";

export const metadata: Metadata = {
  title: "Refunds Report",
};

export default function RefundsReportPage(): JSX.Element {
  return <RefundsReportPageClient />;
}
