import type { Metadata } from "next";
import type { JSX } from "react";

import { ProfitLossPageClient } from "@/components/accounting/profit-loss-page-client";

export const metadata: Metadata = {
  title: "Profit & Loss",
};

export default function ProfitLossPage(): JSX.Element {
  return <ProfitLossPageClient />;
}
