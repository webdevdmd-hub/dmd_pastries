import type { JSX } from "react";

import { PurchaseOrderDetailsPageClient } from "@/components/purchasing/purchase-order-details-page-client";

type PurchaseOrderDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseOrderDetailsPage({
  params,
}: PurchaseOrderDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <PurchaseOrderDetailsPageClient orderId={resolvedParams.id} />;
}
