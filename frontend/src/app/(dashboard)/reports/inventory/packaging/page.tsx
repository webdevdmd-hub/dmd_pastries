import type { Metadata } from "next";
import type { JSX } from "react";

import { PackagingStockPageClient } from "@/components/reports/inventory/packaging-stock-page-client";

export const metadata: Metadata = {
  title: "Packaging Stock Report | Pastries POS",
};

export default function PackagingStockReportPage(): JSX.Element {
  return <PackagingStockPageClient />;
}
