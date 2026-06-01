import type { Metadata } from "next";
import type { JSX } from "react";

import { LowStockPageClient } from "@/components/reports/inventory/low-stock-page-client";

export const metadata: Metadata = {
  title: "Low Stock Report | Pastries POS",
};

export default function LowStockReportPage(): JSX.Element {
  return <LowStockPageClient />;
}
