import type { JSX } from "react";

import { RecipeFormPage } from "@/components/recipes/recipe-form-page";

type RecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RecipePage({ params }: RecipePageProps): Promise<JSX.Element> {
  const resolvedParams = await params;
  const recipeId = resolvedParams.id === "new" ? null : resolvedParams.id;

  return <RecipeFormPage recipeId={recipeId} />;
}
