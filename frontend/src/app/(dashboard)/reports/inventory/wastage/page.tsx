import type { Metadata } from "next";
import type { JSX } from "react";

import { WastageReportPageClient } from "@/components/reports/inventory/wastage-report-page-client";

export const metadata: Metadata = {
  title: "Wastage Report | Pastries POS",
};

export default function WastageReportPage(): JSX.Element {
  return <WastageReportPageClient />;
}
