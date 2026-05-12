import type { Metadata } from "next";
import type { JSX } from "react";

import { ExpiryReportPageClient } from "@/components/reports/inventory/expiry-report-page-client";

export const metadata: Metadata = {
  title: "Expiry Report | Pastries POS",
};

export default function ExpiryReportPage(): JSX.Element {
  return <ExpiryReportPageClient />;
}
