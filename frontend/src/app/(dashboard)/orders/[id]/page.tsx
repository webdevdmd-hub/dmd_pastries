import type { JSX } from "react";

import { OrderDetailsPageClient } from "@/components/orders/order-details-page-client";
import { OrderFormPage } from "@/components/orders/order-form-page";

type OrderPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  if (resolvedParams.id === "new") {
    return <OrderFormPage orderId={null} />;
  }

  if (resolvedSearchParams.mode === "edit") {
    return <OrderFormPage orderId={resolvedParams.id} />;
  }

  return <OrderDetailsPageClient orderId={resolvedParams.id} />;
}
