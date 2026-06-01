import type { Metadata } from "next";
import type { JSX } from "react";

import { OrderStatusReportPageClient } from "@/components/reports/bakery-orders/order-status-report-page-client";

export const metadata: Metadata = { title: "Order Status Report | Pastries POS" };

export default function OrderStatusReportPage(): JSX.Element {
  return <OrderStatusReportPageClient />;
}
