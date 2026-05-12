import type { JSX } from "react";

import { AuditPageClient } from "@/components/stock-movements/audit-page-client";

type InventoryAuditPageProps = {
  params: Promise<{
    inventoryItemId: string;
  }>;
};

export default async function InventoryAuditPage({
  params,
}: InventoryAuditPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <AuditPageClient inventoryItemId={resolvedParams.inventoryItemId} />;
}
