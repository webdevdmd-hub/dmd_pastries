import type { Metadata } from "next";
import type { JSX } from "react";

import { TaxReportPageClient } from "@/components/reports/sales/tax-report-page-client";

export const metadata: Metadata = {
  title: "Tax Report | Pastries POS",
};

export default function TaxReportPage(): JSX.Element {
  return <TaxReportPageClient />;
}
