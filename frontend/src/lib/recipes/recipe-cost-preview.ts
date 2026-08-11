import type {
  RecipeIngredientLine,
  RecipePackagingLine,
  RecipeProductOption,
} from "@/types/recipes";

type NumericInput = number | string | null | undefined;

export type RecipeCostIngredientInput = {
  componentProductId: string | null;
  componentVariantId: string | null;
  quantityRequired: NumericInput;
  unitCostSnapshot?: NumericInput;
  unitId: string;
  wastagePercentage: NumericInput;
};

export type RecipeCostPackagingInput = {
  componentProductId: string | null;
  componentVariantId: string | null;
  quantityRequired: NumericInput;
  unitCostSnapshot?: NumericInput;
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

function roundQuantity(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function numberOrZero(value: NumericInput): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 0;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
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
  snapshot: NumericInput = 0,
): number {
  const product = productForLine(products, componentProductId);
  const variant =
    product?.variants.find((productVariant) => productVariant.id === componentVariantId) ?? null;

  return variant?.costPrice ?? product?.costPrice ?? numberOrZero(snapshot);
}

function lineHasUnitMismatch(
  products: RecipeProductOption[],
  componentProductId: string | null,
  unitId: string,
): boolean {
  const product = productForLine(products, componentProductId);
  return (
    product !== null && product.unitId.length > 0 && unitId.length > 0 && product.unitId !== unitId
  );
}

export function ingredientLineToCostInput(line: RecipeIngredientLine): RecipeCostIngredientInput {
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
  batchYieldQuantity: NumericInput;
  componentProducts: RecipeProductOption[];
  ingredients: RecipeCostIngredientInput[];
  packaging: RecipeCostPackagingInput[];
}): RecipeLiveCostPreview {
  const normalizedYieldQuantity = numberOrZero(batchYieldQuantity);
  const ingredientCost = ingredients.reduce((total, line) => {
    const unitCost = unitCostForLine(
      componentProducts,
      line.componentProductId,
      line.componentVariantId,
      line.unitCostSnapshot,
    );
    const quantityRequired = numberOrZero(line.quantityRequired);
    const wastagePercentage = numberOrZero(line.wastagePercentage);
    const effectiveQuantity = quantityRequired * (1 + wastagePercentage / 100);
    return total + roundMoney(effectiveQuantity * unitCost);
  }, 0);

  const packagingCost = packaging.reduce((total, line) => {
    const unitCost = unitCostForLine(
      componentProducts,
      line.componentProductId,
      line.componentVariantId,
      line.unitCostSnapshot,
    );
    const quantityRequired = numberOrZero(line.quantityRequired);
    return total + roundMoney(quantityRequired * unitCost);
  }, 0);

  const roundedIngredientCost = roundMoney(ingredientCost);
  const roundedPackagingCost = roundMoney(packagingCost);
  const totalCost = roundMoney(roundedIngredientCost + roundedPackagingCost);
  const yieldQuantityValid = normalizedYieldQuantity > 0;
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
    batchYieldQuantity: yieldQuantityValid ? normalizedYieldQuantity : 0,
    costPerYieldUnit: yieldQuantityValid ? roundQuantity(totalCost / normalizedYieldQuantity) : 0,
    estimatedIngredientCost: roundedIngredientCost,
    estimatedPackagingCost: roundedPackagingCost,
    estimatedTotalCost: totalCost,
    hasLines: ingredients.length > 0 || packaging.length > 0,
    hasUnitMismatch,
    hasZeroCostComponents,
    yieldQuantityValid,
  };
}
