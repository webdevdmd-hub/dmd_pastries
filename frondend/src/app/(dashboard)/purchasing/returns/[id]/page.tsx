import type { Metadata } from "next";
import type { JSX } from "react";

import { PurchaseReturnDetailsPageClient } from "@/components/purchasing/purchase-return-details-page-client";

export const metadata: Metadata = {
  title: "Vendor Credit | Pastries POS",
};

type PurchaseReturnDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PurchaseReturnDetailsPage({
  params,
}: PurchaseReturnDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <PurchaseReturnDetailsPageClient purchaseReturnId={resolvedParams.id} />;
}
