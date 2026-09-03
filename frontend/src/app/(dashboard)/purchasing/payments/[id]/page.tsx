import type { Metadata } from "next";
import type { JSX } from "react";

import { SupplierPaymentDetailsPageClient } from "@/components/purchasing/supplier-payment-details-page-client";

export const metadata: Metadata = {
  title: "Payment made",
};

type SupplierPaymentDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SupplierPaymentDetailsPage({
  params,
}: SupplierPaymentDetailsPageProps): Promise<JSX.Element> {
  const { id } = await params;

  return <SupplierPaymentDetailsPageClient paymentId={id} />;
}
