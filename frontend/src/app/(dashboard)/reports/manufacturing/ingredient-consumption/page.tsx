import type { Metadata } from "next";
import type { JSX } from "react";

import { IngredientConsumptionReportPageClient } from "@/components/reports/manufacturing/ingredient-consumption-report-page-client";

export const metadata: Metadata = { title: "Ingredient Consumption Report | Pastries POS" };

export default function IngredientConsumptionReportPage(): JSX.Element {
  return <IngredientConsumptionReportPageClient />;
}
