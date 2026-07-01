import type { JSX } from "react";

import { SuperAdminUserDetailPageClient } from "@/components/super-admin/user-detail-page-client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SuperAdminUserDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const { id } = await params;

  return <SuperAdminUserDetailPageClient userId={id} />;
}
