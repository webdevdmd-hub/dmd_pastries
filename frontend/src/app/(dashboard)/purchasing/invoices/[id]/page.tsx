import type { JSX } from "react";

import { PurchaseInvoiceDetailsPageClient } from "@/components/purchasing/purchase-invoice-details-page-client";

type PurchaseInvoiceDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseInvoiceDetailsPage({
  params,
}: PurchaseInvoiceDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <PurchaseInvoiceDetailsPageClient invoiceId={resolvedParams.id} />;
}
