import type { JSX } from "react";

import { SaleDetailPageClient } from "@/components/payments/sale-detail-page-client";

type SaleDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SaleDetailPage({
  params,
}: SaleDetailPageProps): Promise<JSX.Element> {
  const { id } = await params;

  return <SaleDetailPageClient saleId={id} />;
}
