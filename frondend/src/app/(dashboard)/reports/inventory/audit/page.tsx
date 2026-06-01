import type { Metadata } from "next";
import type { JSX } from "react";

import { InventoryAuditPageClient } from "@/components/reports/inventory/inventory-audit-page-client";

export const metadata: Metadata = {
  title: "Inventory Audit Report | Pastries POS",
};

export default function InventoryAuditReportPage(): JSX.Element {
  return <InventoryAuditPageClient />;
}
