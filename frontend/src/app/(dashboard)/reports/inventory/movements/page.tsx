import type { Metadata } from "next";
import type { JSX } from "react";

import { InventoryMovementsPageClient } from "@/components/reports/inventory/inventory-movements-page-client";

export const metadata: Metadata = {
  title: "Inventory Movements Report | Pastries POS",
};

export default function InventoryMovementsReportPage(): JSX.Element {
  return <InventoryMovementsPageClient />;
}
