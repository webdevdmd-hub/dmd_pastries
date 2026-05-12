import type { JSX } from "react";

import { MasterDataPageClient } from "@/components/master-data/master-data-page-client";

export default function IngredientCategoriesPage(): JSX.Element {
  return <MasterDataPageClient collection="ingredient-categories" />;
}
