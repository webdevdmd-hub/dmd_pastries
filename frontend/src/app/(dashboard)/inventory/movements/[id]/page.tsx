import type { JSX } from "react";

import { MovementDetailsPageClient } from "@/components/stock-movements/movement-details-page-client";

type StockMovementDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockMovementDetailsPage({
  params,
}: StockMovementDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <MovementDetailsPageClient movementId={resolvedParams.id} />;
}
