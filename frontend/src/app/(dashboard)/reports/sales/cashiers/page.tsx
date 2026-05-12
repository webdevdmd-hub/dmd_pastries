import type { Metadata } from "next";
import type { JSX } from "react";

import { CashierSalesPageClient } from "@/components/reports/sales/cashier-sales-page-client";

export const metadata: Metadata = {
  title: "Cashier Sales | Pastries POS",
};

export default function CashierSalesPage(): JSX.Element {
  return <CashierSalesPageClient />;
}
