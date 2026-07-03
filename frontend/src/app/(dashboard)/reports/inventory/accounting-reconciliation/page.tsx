import type { Metadata } from "next";
import type { JSX } from "react";

import { InventoryAccountingReconciliationPageClient } from "@/components/reports/inventory/inventory-accounting-reconciliation-page-client";

export const metadata: Metadata = {
  title: "Inventory Accounting Reconciliation | Reports",
};

export default function InventoryAccountingReconciliationPage(): JSX.Element {
  return <InventoryAccountingReconciliationPageClient />;
}
