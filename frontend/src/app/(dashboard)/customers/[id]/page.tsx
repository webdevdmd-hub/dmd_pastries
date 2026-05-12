import type { JSX } from "react";

import { CustomerDetailsPageClient } from "@/components/customers/customer-details-page-client";

type CustomerDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailsPage({
  params,
}: CustomerDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <CustomerDetailsPageClient customerId={resolvedParams.id} />;
}
