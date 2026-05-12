import type { Metadata } from "next";
import type { JSX } from "react";

import { SalesReportsPageClient } from "@/components/reports/sales/sales-reports-page-client";

export const metadata: Metadata = {
  title: "Sales Reports | Pastries POS",
};

export default function SalesReportsPage(): JSX.Element {
  return <SalesReportsPageClient />;
}
