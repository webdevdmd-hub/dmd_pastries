import type { Metadata } from "next";
import type { JSX } from "react";

import { OutstandingBalancesPageClient } from "@/components/reports/financial/outstanding-balances-page-client";

export const metadata: Metadata = {
  title: "Outstanding Balances",
};

export default function OutstandingBalancesPage(): JSX.Element {
  return <OutstandingBalancesPageClient />;
}
