import type { Metadata } from "next";
import type { JSX } from "react";

import { BranchSalesPageClient } from "@/components/reports/sales/branch-sales-page-client";

export const metadata: Metadata = {
  title: "Branch Sales | Pastries POS",
};

export default function BranchSalesPage(): JSX.Element {
  return <BranchSalesPageClient />;
}
