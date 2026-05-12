export type IngredientStatus = "active" | "inactive";

export type IngredientCategory = {
  id: string;
  categoryName: string;
  description: string;
  status: IngredientStatus;
};

export type IngredientSupplierOption = {
  id: string;
  supplierName: string;
};

export type IngredientUnitOption = {
  id: string;
  unitName: string;
  symbol: string;
};

export type Ingredient = {
  id: string;
  businessId: string;
  ingredientCode: string;
  ingredientName: string;
  ingredientCategoryId: string;
  ingredientCategoryName: string;
  supplierId: string | null;
  supplierName: string | null;
  unitId: string;
  unitName: string;
  unitSymbol: string;
  costPerUnit: number;
  isStockTracked: boolean;
  isExpiryTracked: boolean;
  reorderLevel: number;
  description: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  status: IngredientStatus;
  createdByUserName: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateIngredientPayload = {
  ingredientName: string;
  ingredientCategoryId: string;
  supplierId: string | null;
  unitId: string;
  costPerUnit: number;
  isStockTracked: boolean;
  isExpiryTracked: boolean;
  reorderLevel: number;
  description: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
};

export type UpdateIngredientPayload = Partial<CreateIngredientPayload>;

export type UpdateIngredientStatusPayload = {
  status: IngredientStatus;
};

export type IngredientFilters = {
  search: string;
  categoryId: string;
  supplierId: string;
  status: IngredientStatus | "all";
  stockTracked: "all" | "true" | "false";
};

export type IngredientLookupParams = {
  search: string;
  limit?: number;
};
