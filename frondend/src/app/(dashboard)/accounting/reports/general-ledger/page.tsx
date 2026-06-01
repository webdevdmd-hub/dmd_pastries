import type { Metadata } from "next";
import type { JSX } from "react";

import { GeneralLedgerPageClient } from "@/components/accounting/general-ledger-page-client";

export const metadata: Metadata = {
  title: "General Ledger",
};

export default function GeneralLedgerPage(): JSX.Element {
  return <GeneralLedgerPageClient />;
}
