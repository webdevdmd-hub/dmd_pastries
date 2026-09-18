import type { ProductReferenceData, ProductType } from "@/types/product";

type CategoryReference = ProductReferenceData["categories"][number];

/** What the form knows about the product being edited, if any. */
type CurrentReferences = {
  categoryId: string;
  categoryName: string;
  productType: ProductType;
  unitId: string;
  unitName: string;
} | null;

export type UnitOption = { id: string; label: string };

/**
 * The categories the product form offers.
 *
 * The lookups endpoint returns active categories only (ISSUE-089). A product
 * already filed under a category that has since been deactivated would then
 * have no matching option: the form blanked its category and refused to save
 * until another was picked. The server accepts the unchanged inactive
 * category, so the form keeps offering it -- marked, and only for the product
 * type it was saved with -- alongside the active ones.
 */
export function productCategoryOptions(
  categories: CategoryReference[],
  current: CurrentReferences,
): CategoryReference[] {
  if (!current?.categoryId || categories.some((category) => category.id === current.categoryId)) {
    return categories;
  }
  return [
    ...categories,
    {
      id: current.categoryId,
      categoryName: `${current.categoryName} (inactive)`,
      allowedProductTypes: [current.productType],
    },
  ];
}

/** The units the product form offers; the same rule as productCategoryOptions. */
export function productUnitOptions(
  units: ProductReferenceData["units"],
  current: CurrentReferences,
): UnitOption[] {
  const options = units.map((unit) => ({
    id: unit.id,
    label: `${unit.unitName} (${unit.symbol})`,
  }));
  if (!current?.unitId || options.some((option) => option.id === current.unitId)) {
    return options;
  }
  return [...options, { id: current.unitId, label: `${current.unitName} (inactive)` }];
}
