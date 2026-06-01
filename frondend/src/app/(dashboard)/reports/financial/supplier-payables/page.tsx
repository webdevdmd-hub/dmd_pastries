import type { Metadata } from "next";
import type { JSX } from "react";

import { SupplierPayablesPageClient } from "@/components/reports/financial/supplier-payables-page-client";

export const metadata: Metadata = {
  title: "Supplier Payables",
};

export default function SupplierPayablesPage(): JSX.Element {
  return <SupplierPayablesPageClient />;
}
