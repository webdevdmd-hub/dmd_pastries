import type { Metadata } from "next";
import type { JSX } from "react";

import { ProductSalesPageClient } from "@/components/reports/sales/product-sales-page-client";

export const metadata: Metadata = {
  title: "Product Sales | Pastries POS",
};

export default function ProductSalesPage(): JSX.Element {
  return <ProductSalesPageClient />;
}
