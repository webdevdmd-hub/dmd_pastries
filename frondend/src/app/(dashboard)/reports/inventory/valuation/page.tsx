import type { Metadata } from "next";
import type { JSX } from "react";

import { StockValuationPageClient } from "@/components/reports/inventory/stock-valuation-page-client";

export const metadata: Metadata = {
  title: "Stock Valuation Report | Pastries POS",
};

export default function StockValuationReportPage(): JSX.Element {
  return <StockValuationPageClient />;
}
