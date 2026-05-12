import type { Metadata } from "next";
import type { JSX } from "react";

import { DeliveryVsPickupPageClient } from "@/components/reports/bakery-orders/delivery-vs-pickup-page-client";

export const metadata: Metadata = { title: "Delivery vs Pickup Report | Pastries POS" };

export default function DeliveryVsPickupReportPage(): JSX.Element {
  return <DeliveryVsPickupPageClient />;
}
