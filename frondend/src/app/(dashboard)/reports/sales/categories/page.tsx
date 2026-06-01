import type { Metadata } from "next";
import type { JSX } from "react";

import { CategorySalesPageClient } from "@/components/reports/sales/category-sales-page-client";

export const metadata: Metadata = {
  title: "Category Sales | Pastries POS",
};

export default function CategorySalesPage(): JSX.Element {
  return <CategorySalesPageClient />;
}
