import type { Metadata } from "next";
import type { JSX } from "react";

import { TrialBalancePageClient } from "@/components/accounting/trial-balance-page-client";

export const metadata: Metadata = {
  title: "Trial Balance",
};

export default function TrialBalancePage(): JSX.Element {
  return <TrialBalancePageClient />;
}
