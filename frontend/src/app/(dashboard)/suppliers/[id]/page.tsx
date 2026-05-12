import type { JSX } from "react";

import { SupplierDetailsPageClient } from "@/components/suppliers/supplier-details-page-client";

type SupplierDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SupplierDetailsPage({
  params,
}: SupplierDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <SupplierDetailsPageClient supplierId={resolvedParams.id} />;
}
