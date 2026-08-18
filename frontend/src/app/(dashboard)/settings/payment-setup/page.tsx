import type { Metadata } from "next";
import type { JSX } from "react";

import { PaymentSetupPageClient } from "@/components/settings/payment-setup-page-client";

const validTabs = ["overview", "methods", "accounts", "branches"] as const;

type PaymentSetupTab = (typeof validTabs)[number];

type PaymentSetupPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

function parseTab(value: string | undefined): PaymentSetupTab {
  return validTabs.find((tab) => tab === value) ?? "overview";
}

export const metadata: Metadata = {
  title: "Payment Methods & Accounts",
};

export default async function PaymentSetupPage({
  searchParams,
}: PaymentSetupPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = await searchParams;

  return <PaymentSetupPageClient initialTab={parseTab(resolvedSearchParams.tab)} />;
}
