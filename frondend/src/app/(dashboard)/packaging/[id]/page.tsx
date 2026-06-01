import type { JSX } from "react";

import { PackagingDetailsPageClient } from "@/components/packaging/packaging-details-page-client";

type PackagingDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PackagingDetailsPage({
  params,
}: PackagingDetailsPageProps): Promise<JSX.Element> {
  const resolvedParams = await params;

  return <PackagingDetailsPageClient packagingId={resolvedParams.id} />;
}
