import type { JSX } from "react";

import { BatchDetailsPageClient } from "@/components/manufacturing/batch-details-page-client";

type ManufacturingBatchDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ManufacturingBatchDetailsPage({
  params,
}: ManufacturingBatchDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <BatchDetailsPageClient batchId={resolvedParams.id} />;
}
