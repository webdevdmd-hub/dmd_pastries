import type { Metadata } from "next";
import type { JSX } from "react";

import { BalanceSheetPageClient } from "@/components/accounting/balance-sheet-page-client";

export const metadata: Metadata = {
  title: "Balance Sheet",
};

export default function BalanceSheetPage(): JSX.Element {
  return <BalanceSheetPageClient />;
}
