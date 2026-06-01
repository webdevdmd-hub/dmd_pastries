import type { Metadata } from "next";
import type { JSX } from "react";

import { ReceiptsReportPageClient } from "@/components/reports/receipts-report-page-client";

export const metadata: Metadata = {
  title: "Sales Receipts | Pastries POS",
};

export default function ReceiptsReportPage(): JSX.Element {
  return <ReceiptsReportPageClient />;
}
