import type { Metadata } from "next";

import { ReceiptsReportPageClient } from "@/components/reports/receipts-report-page-client";

export const metadata: Metadata = {
  title: "Sales Receipts",
};

export default function ReceiptsReportPage() {
  return <ReceiptsReportPageClient />;
}
