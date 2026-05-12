import type { Metadata } from "next";
import type { JSX } from "react";

import { PaymentsReportPageClient } from "@/components/reports/financial/payments-report-page-client";

export const metadata: Metadata = {
  title: "Payments Report",
};

export default function PaymentsReportPage(): JSX.Element {
  return <PaymentsReportPageClient />;
}
