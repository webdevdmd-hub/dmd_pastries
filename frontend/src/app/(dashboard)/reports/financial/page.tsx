import type { Metadata } from "next";
import type { JSX } from "react";

import { FinancialReportsPageClient } from "@/components/reports/financial/financial-reports-page-client";

export const metadata: Metadata = {
  title: "Financial Reports",
};

export default function FinancialReportsPage(): JSX.Element {
  return <FinancialReportsPageClient />;
}
