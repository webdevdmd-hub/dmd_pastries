import type { Metadata } from "next";
import type { JSX } from "react";

import { InventoryReportsPageClient } from "@/components/reports/inventory/inventory-reports-page-client";

export const metadata: Metadata = {
  title: "Inventory Reports | Pastries POS",
};

export default function InventoryReportsPage(): JSX.Element {
  return <InventoryReportsPageClient />;
}
