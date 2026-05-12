import type { Metadata } from "next";
import type { JSX } from "react";

import { RecipeCostReportPageClient } from "@/components/reports/manufacturing/recipe-cost-report-page-client";

export const metadata: Metadata = { title: "Recipe Cost Report | Pastries POS" };

export default function RecipeCostReportPage(): JSX.Element {
  return <RecipeCostReportPageClient />;
}
