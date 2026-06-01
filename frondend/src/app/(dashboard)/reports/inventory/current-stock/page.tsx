import type { Metadata } from "next";
import type { JSX } from "react";

import { CurrentStockPageClient } from "@/components/reports/inventory/current-stock-page-client";

export const metadata: Metadata = {
  title: "Current Stock Report | Pastries POS",
};

export default function CurrentStockReportPage(): JSX.Element {
  return <CurrentStockPageClient />;
}
