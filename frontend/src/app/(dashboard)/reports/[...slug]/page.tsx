import type { Metadata } from "next";
import type { JSX } from "react";

import { ReportUnavailablePageClient } from "@/components/reports/report-unavailable-page-client";

type ReportUnavailablePageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export const metadata: Metadata = {
  title: "Report Not Available | Pastries POS",
};

export default async function ReportUnavailablePage({
  params,
}: ReportUnavailablePageProps): Promise<JSX.Element> {
  const { slug } = await params;

  return <ReportUnavailablePageClient slug={slug} />;
}
