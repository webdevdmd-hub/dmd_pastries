import type { Metadata } from "next";
import type { JSX } from "react";

import { PendingPaymentsPageClient } from "@/components/reports/bakery-orders/pending-payments-page-client";

export const metadata: Metadata = { title: "Pending Payments Report | Pastries POS" };

export default function PendingPaymentsReportPage(): JSX.Element {
  return <PendingPaymentsPageClient />;
}
