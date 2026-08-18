import type { Metadata } from "next";
import type { JSX } from "react";

import { PurchaseSupplierPaymentsPageClient } from "@/components/purchasing/purchase-supplier-payments-page-client";

export const metadata: Metadata = {
  title: "Payments Made",
};

export default function SupplierPaymentsPage(): JSX.Element {
  return <PurchaseSupplierPaymentsPageClient />;
}
