import type { ItemStructure, ProductType } from "@/types/product";

export type RecipeStatus = "draft" | "active" | "inactive" | "archived";

export type Recipe = {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  productVariantId: string | null;
  productVariantName: string | null;
  recipeCode: string;
  recipeName: string;
  description: string | null;
  batchYieldQuantity: number;
  batchYieldUnitId: string;
  batchYieldUnitName: string;
  preparationTimeMinutes: number | null;
  instructions: string | null;
  estimatedIngredientCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  costPerYieldUnit: number;
  versionNumber: number;
  isActive: boolean;
  status: RecipeStatus;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredientLine = {
  id: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  componentProductName: string | null;
  componentVariantName: string | null;
  componentProductType: ProductType | null;
  inventoryItemId: string;
  itemNameSnapshot: string;
  quantityRequired: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCostSnapshot: number;
  totalCost: number;
  wastagePercentage: number;
  notes: string | null;
  sortOrder: number;
};

export type RecipePackagingLine = {
  id: string;
  componentProductId: string | null;
  componentVariantId: string | null;
  componentProductName: string | null;
  componentVariantName: string | null;
  componentProductType: ProductType | null;
  packagingItemId: string;
  packagingNameSnapshot: string;
  quantityRequired: number;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  unitCostSnapshot: number;
  totalCost: number;
  isOptional: boolean;
  sortOrder: number;
};

export type RecipeCost = {
  estimatedIngredientCost: number;
  estimatedPackagingCost: number;
  estimatedTotalCost: number;
  batchYieldQuantity: number;
  costPerYieldUnit: number;
};

export type RecipeVersion = {
  id: string;
  recipeId: string;
  versionNumber: number;
  changeNote: string | null;
  createdByUserName: string;
  createdAt: string;
};

export type RecipeIngredientPayload = {
  componentProductId: string;
  componentVariantId: string | null;
  quantityRequired: number;
  unitId: string;
  wastagePercentage: number;
  notes: string | null;
  sortOrder: number;
};

export type RecipePackagingPayload = {
  componentProductId: string;
  componentVariantId: string | null;
  quantityRequired: number;
  unitId: string;
  isOptional: boolean;
  sortOrder: number;
};

export type RecipeNewProductVariantPayload = {
  variantName: string;
  sku: string | null;
  salePrice: number;
};

export type CreateRecipePayload = {
  productId: string;
  productVariantId: string | null;
  newProductVariant: RecipeNewProductVariantPayload | null;
  recipeName: string;
  description: string | null;
  batchYieldQuantity: number;
  batchYieldUnitId: string;
  preparationTimeMinutes: number | null;
  instructions: string | null;
  ingredients: RecipeIngredientPayload[];
  packaging: RecipePackagingPayload[];
};

export type UpdateRecipePayload = Partial<CreateRecipePayload>;

export type UpdateRecipeStatusPayload = {
  status: RecipeStatus;
  isActive?: boolean;
};

export type CreateRecipeVersionPayload = {
  changeNote: string | null;
};

export type RecipeFilters = {
  search: string;
  productId: string;
  status: RecipeStatus | "all";
  active: "all" | "true" | "false";
};

export type RecipeProductOption = {
  id: string;
  productCode: string;
  productName: string;
  productType: ProductType;
  itemStructure: ItemStructure;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  isStockTracked: boolean;
  variants: RecipeProductVariantOption[];
};

export type RecipeProductVariantOption = {
  id: string;
  variantName: string;
  sku: string | null;
  salePrice: number;
};

export type RecipeUnitOption = {
  id: string;
  unitName: string;
  unitSymbol: string;
};
