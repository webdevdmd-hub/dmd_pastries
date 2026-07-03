import type { RecipeIngredientPayload, RecipePackagingPayload } from "@/types/recipes";

export const RECIPE_SELF_REFERENCE_MESSAGE =
  "The parent product cannot be used as an ingredient in its own recipe.";

export function isSelfReferencingRecipeLine(
  parentProductId: string,
  line: Pick<RecipeIngredientPayload | RecipePackagingPayload, "componentProductId">,
): boolean {
  return parentProductId.trim().length > 0 && line.componentProductId === parentProductId;
}

export function hasSelfReferencingRecipeLine(
  parentProductId: string,
  lines: Pick<RecipeIngredientPayload | RecipePackagingPayload, "componentProductId">[],
): boolean {
  return lines.some((line) => isSelfReferencingRecipeLine(parentProductId, line));
}
