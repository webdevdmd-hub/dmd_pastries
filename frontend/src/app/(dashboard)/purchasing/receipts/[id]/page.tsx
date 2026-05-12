import type { JSX } from "react";

import { PurchaseReceiptDetailsPageClient } from "@/components/purchasing/purchase-receipt-details-page-client";

type PurchaseReceiptDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseReceiptDetailsPage({
  params,
}: PurchaseReceiptDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <PurchaseReceiptDetailsPageClient receiptId={resolvedParams.id} />;
}
