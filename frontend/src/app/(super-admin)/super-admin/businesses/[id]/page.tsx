import type { JSX } from "react";

import { SuperAdminBusinessDetailPageClient } from "@/components/super-admin/business-detail-page-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SuperAdminBusinessDetailPage({
  params,
}: PageProps): Promise<JSX.Element> {
  const { id } = await params;

  return <SuperAdminBusinessDetailPageClient businessId={id} />;
}
