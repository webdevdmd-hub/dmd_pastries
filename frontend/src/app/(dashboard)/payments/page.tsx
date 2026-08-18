import type { Metadata } from "next";
import type { JSX } from "react";

import { PaymentsTabShell } from "@/components/payments/payments-tab-shell";
import { parsePaymentsTab } from "@/components/payments/payments-tabs";

export const metadata: Metadata = {
  title: "Payments",
};

type PaymentsPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function PaymentsPage({
  searchParams,
}: PaymentsPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = await searchParams;

  return <PaymentsTabShell activeTab={parsePaymentsTab(resolvedSearchParams.tab)} />;
}
