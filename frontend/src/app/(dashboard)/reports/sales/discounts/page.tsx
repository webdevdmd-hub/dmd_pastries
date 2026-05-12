import type { Metadata } from "next";
import type { JSX } from "react";

import { DiscountReportPageClient } from "@/components/reports/sales/discount-report-page-client";

export const metadata: Metadata = {
  title: "Discount Report | Pastries POS",
};

export default function DiscountReportPage(): JSX.Element {
  return <DiscountReportPageClient />;
}
