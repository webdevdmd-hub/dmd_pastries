import type { Metadata } from "next";
import type { JSX } from "react";

import { UpcomingOrdersPageClient } from "@/components/reports/bakery-orders/upcoming-orders-page-client";

export const metadata: Metadata = { title: "Upcoming Orders Report | Pastries POS" };

export default function UpcomingOrdersReportPage(): JSX.Element {
  return <UpcomingOrdersPageClient />;
}
