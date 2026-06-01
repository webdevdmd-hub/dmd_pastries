import type { Metadata } from "next";
import type { JSX } from "react";

import { ProductionBatchesReportPageClient } from "@/components/reports/manufacturing/production-batches-report-page-client";

export const metadata: Metadata = { title: "Production Batches Report | Pastries POS" };

export default function ProductionBatchesReportPage(): JSX.Element {
  return <ProductionBatchesReportPageClient />;
}
