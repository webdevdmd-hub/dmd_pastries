import type { Metadata } from "next";
import type { JSX } from "react";

import { ManufacturingWastageReportPageClient } from "@/components/reports/manufacturing/manufacturing-wastage-report-page-client";

export const metadata: Metadata = { title: "Manufacturing Wastage Report | Pastries POS" };

export default function ManufacturingWastageReportPage(): JSX.Element {
  return <ManufacturingWastageReportPageClient />;
}
