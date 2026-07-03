export function formatRecipeVersionLabel(versionNumber: number | null): string {
  return versionNumber !== null && versionNumber > 0
    ? `Recipe Version v${String(versionNumber)}`
    : "Recipe Version unavailable";
}
