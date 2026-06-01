import type { Metadata } from "next";
import type { JSX } from "react";

import { YieldVarianceReportPageClient } from "@/components/reports/manufacturing/yield-variance-report-page-client";

export const metadata: Metadata = { title: "Yield Variance Report | Pastries POS" };

export default function YieldVarianceReportPage(): JSX.Element {
  return <YieldVarianceReportPageClient />;
}
