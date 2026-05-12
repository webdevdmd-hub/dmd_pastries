import type { JSX } from "react";

import { IngredientDetailsPageClient } from "@/components/ingredients/ingredient-details-page-client";

type IngredientDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function IngredientDetailsPage({
  params,
}: IngredientDetailsPageProps): Promise<JSX.Element> {
  const { id } = await params;
  return <IngredientDetailsPageClient ingredientId={id} />;
}
