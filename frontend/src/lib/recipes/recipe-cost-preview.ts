import type { RecipeIngredientLine, RecipePackagingLine, RecipeProductOption } from "@/types/recipes";

export type RecipeCostIngredientInput = {
  componentProductId: string | null;
  componentVariantId: string | null;
  quantityRequired: number;
  unitCostSnapshot?: number;
  unitId: string;
  wastagePercentage: number;
};

export type RecipeCostPackagingInput = {
  componentProductId: string | null;
  componentVariantId: string | null;
  quantityRequired: number;
  unitCostSnapshot?: number;
  unitId: string;
};

export type RecipeLiveCostPreview = {
  batchYieldQuantity: number;
  costPerYieldUnit: number;
  estimatedIngredientCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  hasLines: boolean;
  hasUnitMismatch: boolean;
  hasZeroCostComponents: boolean;
  yieldQuantityValid: boolean;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function productForLine(
  products: RecipeProductOption[],
  componentProductId: string | null,
): RecipeProductOption | null {
  return products.find((item) => item.id === componentProductId) ?? null;
}

function unitCostForLine(
  products: RecipeProductOption[],
  componentProductId: string | null,
  componentVariantId: string | null,
  snapshot = 0,
): number {
  const product = productForLine(products, componentProductId);
  const variant =
    product?.variants.find((productVariant) => productVariant.id === componentVariantId) ?? null;

  return variant?.costPrice ?? product?.costPrice ?? snapshot;
}

function lineHasUnitMismatch(
  products: RecipeProductOption[],
  componentProductId: string | null,
  unitId: string,
): boolean {
  const product = productForLine(products, componentProductId);
  return product !== null && product.unitId.length > 0 && unitId.length > 0 && product.unitId !== unitId;
}

export function ingredientLineToCostInput(
  line: RecipeIngredientLine,
): RecipeCostIngredientInput {
  return {
    componentProductId: line.componentProductId,
    componentVariantId: line.componentVariantId,
    quantityRequired: line.quantityRequired,
    unitCostSnapshot: line.unitCostSnapshot,
    unitId: line.unitId,
    wastagePercentage: line.wastagePercentage,
  };
}

export function packagingLineToCostInput(line: RecipePackagingLine): RecipeCostPackagingInput {
  return {
    componentProductId: line.componentProductId,
    componentVariantId: line.componentVariantId,
    quantityRequired: line.quantityRequired,
    unitCostSnapshot: line.unitCostSnapshot,
    unitId: line.unitId,
  };
}

export function calculateRecipeLiveCostPreview({
  batchYieldQuantity,
  componentProducts,
  ingredients,
  packaging,
}: {
  batchYieldQuantity: number;
  componentProducts: RecipeProductOption[];
  ingredients: RecipeCostIngredientInput[];
  packaging: RecipeCostPackagingInput[];
}): RecipeLiveCostPreview {
  const ingredientCost = ingredients.reduce((total, line) => {
    const unitCost = unitCostForLine(
      componentProducts,
      line.componentProductId,
      line.componentVariantId,
      line.unitCostSnapshot,
    );
    const effectiveQuantity = line.quantityRequired * (1 + line.wastagePercentage / 100);
    return total + effectiveQuantity * unitCost;
  }, 0);

  const packagingCost = packaging.reduce((total, line) => {
    const unitCost = unitCostForLine(
      componentProducts,
      line.componentProductId,
      line.componentVariantId,
      line.unitCostSnapshot,
    );
    return total + line.quantityRequired * unitCost;
  }, 0);

  const totalCost = ingredientCost + packagingCost;
  const yieldQuantityValid = Number.isFinite(batchYieldQuantity) && batchYieldQuantity > 0;
  const hasZeroCostComponents =
    ingredients.some(
      (line) =>
        unitCostForLine(
          componentProducts,
          line.componentProductId,
          line.componentVariantId,
          line.unitCostSnapshot,
        ) <= 0,
    ) ||
    packaging.some(
      (line) =>
        unitCostForLine(
          componentProducts,
          line.componentProductId,
          line.componentVariantId,
          line.unitCostSnapshot,
        ) <= 0,
    );
  const hasUnitMismatch =
    ingredients.some((line) =>
      lineHasUnitMismatch(componentProducts, line.componentProductId, line.unitId),
    ) ||
    packaging.some((line) =>
      lineHasUnitMismatch(componentProducts, line.componentProductId, line.unitId),
    );

  return {
    batchYieldQuantity: yieldQuantityValid ? batchYieldQuantity : 0,
    costPerYieldUnit: yieldQuantityValid ? roundMoney(totalCost / batchYieldQuantity) : 0,
    estimatedIngredientCost: roundMoney(ingredientCost),
    estimatedPackagingCost: roundMoney(packagingCost),
    estimatedTotalCost: roundMoney(totalCost),
    hasLines: ingredients.length > 0 || packaging.length > 0,
    hasUnitMismatch,
    hasZeroCostComponents,
    yieldQuantityValid,
  };
}
