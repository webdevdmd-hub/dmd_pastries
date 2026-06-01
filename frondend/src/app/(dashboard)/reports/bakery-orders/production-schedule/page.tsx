import type { Metadata } from "next";
import type { JSX } from "react";

import { ProductionSchedulePageClient } from "@/components/reports/bakery-orders/production-schedule-page-client";

export const metadata: Metadata = { title: "Production Schedule Report | Pastries POS" };

export default function ProductionScheduleReportPage(): JSX.Element {
  return <ProductionSchedulePageClient />;
}
