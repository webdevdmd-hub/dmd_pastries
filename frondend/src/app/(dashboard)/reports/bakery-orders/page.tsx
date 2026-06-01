import type { Metadata } from "next";
import type { JSX } from "react";

import { BakeryOrdersReportsPageClient } from "@/components/reports/bakery-orders/bakery-orders-reports-page-client";

export const metadata: Metadata = { title: "Bakery Orders Reports | Pastries POS" };

export default function BakeryOrdersReportsPage(): JSX.Element {
  return <BakeryOrdersReportsPageClient />;
}
