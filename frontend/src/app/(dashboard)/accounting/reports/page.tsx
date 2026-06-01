import type { Metadata } from "next";
import type { JSX } from "react";

import { AccountingReportsPageClient } from "@/components/accounting/accounting-reports-page-client";

export const metadata: Metadata = {
  title: "Accounting Reports",
};

export default function AccountingReportsPage(): JSX.Element {
  return <AccountingReportsPageClient />;
}
