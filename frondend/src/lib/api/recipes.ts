import { apiRequest } from "@/lib/api/client";
import type {
  CreateRecipePayload,
  CreateRecipeVersionPayload,
  Recipe,
  RecipeCost,
  RecipeFilters,
  RecipeIngredientLine,
  RecipeIngredientPayload,
  RecipeInventoryItemOption,
  RecipeNewProductVariantPayload,
  RecipePackagingLine,
  RecipePackagingOption,
  RecipePackagingPayload,
  RecipeProductOption,
  RecipeProductVariantOption,
  RecipeStatus,
  RecipeUnitOption,
  RecipeVersion,
  UpdateRecipePayload,
  UpdateRecipeStatusPayload,
} from "@/types/recipes";

type BackendRecipePayload = {
  product_id?: string;
  product_variant_id?: string | null;
  new_product_variant?: BackendNewProductVariantPayload | null;
  recipe_name?: string;
  description?: string | null;
  batch_yield_quantity?: number;
  batch_yield_unit_id?: string;
  preparation_time_minutes?: number | null;
  instructions?: string | null;
  ingredients?: BackendIngredientPayload[];
  packaging?: BackendPackagingPayload[];
};

type BackendNewProductVariantPayload = {
  variant_name: string;
  sku?: string | null;
  sale_price: number;
};

type BackendIngredientPayload = {
  ingredient_id?: string;
  inventory_item_id?: string;
  quantity_required?: number;
  unit_id?: string;
  wastage_percentage?: number;
  notes?: string | null;
  sort_order?: number;
};

type BackendPackagingPayload = {
  packaging_item_id?: string;
  quantity_required?: number;
  unit_id?: string;
  is_optional?: boolean;
  sort_order?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecipeStatus(value: unknown): value is RecipeStatus {
  return value === "draft" || value === "active" || value === "inactive" || value === "archived";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (isObject(value) && Array.isArray(value.recipes)) {
    return value.recipes.map(parser);
  }

  if (isObject(value) && Array.isArray(value.ingredients)) {
    return value.ingredients.map(parser);
  }

  if (isObject(value) && Array.isArray(value.packaging)) {
    return value.packaging.map(parser);
  }

  if (isObject(value) && Array.isArray(value.versions)) {
    return value.versions.map(parser);
  }

  throw new Error("Backend list payload is invalid.");
}

function parseRecipe(value: unknown): Recipe {
  if (!isObject(value)) {
    throw new Error("Backend recipe payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    productId: stringValue(value.product_id),
    productName: stringValue(value.product_name, "Product"),
    productVariantId: optionalString(value.product_variant_id),
    productVariantName: optionalString(value.product_variant_name),
    recipeCode: stringValue(value.recipe_code, "Recipe"),
    recipeName: stringValue(value.recipe_name, "Unnamed recipe"),
    description: optionalString(value.description),
    batchYieldQuantity: numberValue(value.batch_yield_quantity),
    batchYieldUnitId: stringValue(value.batch_yield_unit_id),
    batchYieldUnitName: stringValue(value.batch_yield_unit_name, "Unit"),
    preparationTimeMinutes:
      typeof value.preparation_time_minutes === "number" ? value.preparation_time_minutes : null,
    instructions: optionalString(value.instructions),
    estimatedIngredientCost: numberValue(value.estimated_ingredient_cost),
    estimatedPackagingCost: numberValue(value.estimated_packaging_cost),
    estimatedTotalCost: numberValue(value.estimated_total_cost),
    costPerYieldUnit: numberValue(value.cost_per_yield_unit),
    versionNumber: numberValue(value.version_number, 1),
    isActive: booleanValue(value.is_active),
    status: isRecipeStatus(value.status) ? value.status : "draft",
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseIngredientLine(value: unknown): RecipeIngredientLine {
  if (!isObject(value)) {
    throw new Error("Backend recipe ingredient payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    inventoryItemId: stringValue(value.ingredient_id, stringValue(value.inventory_item_id)),
    itemNameSnapshot: stringValue(
      value.item_name_snapshot,
      stringValue(value.ingredient_name_snapshot, "Ingredient"),
    ),
    quantityRequired: numberValue(value.quantity_required),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    wastagePercentage: numberValue(value.wastage_percentage),
    notes: optionalString(value.notes),
    sortOrder: numberValue(value.sort_order),
  };
}

function parsePackagingLine(value: unknown): RecipePackagingLine {
  if (!isObject(value)) {
    throw new Error("Backend recipe packaging payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    packagingItemId: stringValue(value.packaging_item_id),
    packagingNameSnapshot: stringValue(value.packaging_name_snapshot, "Packaging item"),
    quantityRequired: numberValue(value.quantity_required),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    unitCostSnapshot: numberValue(value.unit_cost_snapshot),
    totalCost: numberValue(value.total_cost),
    isOptional: booleanValue(value.is_optional),
    sortOrder: numberValue(value.sort_order),
  };
}

function parseRecipeCost(value: unknown): RecipeCost {
  if (!isObject(value)) {
    throw new Error("Backend recipe cost payload is invalid.");
  }

  return {
    estimatedIngredientCost: numberValue(value.estimated_ingredient_cost),
    estimatedPackagingCost: numberValue(value.estimated_packaging_cost),
    estimatedTotalCost: numberValue(value.estimated_total_cost),
    batchYieldQuantity: numberValue(value.batch_yield_quantity),
    costPerYieldUnit: numberValue(value.cost_per_yield_unit),
  };
}

function parseVersion(value: unknown): RecipeVersion {
  if (!isObject(value)) {
    throw new Error("Backend recipe version payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    recipeId: stringValue(value.recipe_id),
    versionNumber: numberValue(value.version_number, 1),
    changeNote: optionalString(value.change_note),
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
  };
}

function parseProductVariantOption(value: unknown): RecipeProductVariantOption {
  if (!isObject(value)) {
    throw new Error("Backend product variant option payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    variantName: stringValue(value.variant_name, "Variant"),
    sku: optionalString(value.sku),
    salePrice: numberValue(value.sale_price),
  };
}

function parseProductOption(value: unknown): RecipeProductOption {
  if (!isObject(value)) {
    throw new Error("Backend product option payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productName: stringValue(value.product_name, "Product"),
    variants: Array.isArray(value.variants)
      ? value.variants.map(parseProductVariantOption).filter((variant) => variant.id.length > 0)
      : [],
  };
}

function parseInventoryOption(value: unknown): RecipeInventoryItemOption {
  if (!isObject(value)) {
    throw new Error("Backend inventory option payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    itemName: stringValue(value.ingredient_name, stringValue(value.item_name, "Ingredient")),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    currentQuantity: numberValue(value.current_quantity),
  };
}

function parsePackagingOption(value: unknown): RecipePackagingOption {
  if (!isObject(value)) {
    throw new Error("Backend packaging option payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    packagingName: stringValue(value.packaging_name, "Packaging item"),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
  };
}

function parseUnitOption(value: unknown): RecipeUnitOption {
  if (!isObject(value)) {
    throw new Error("Backend unit option payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.symbol),
  };
}

function queryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : "";
}

function ingredientPayload(payload: RecipeIngredientPayload): BackendIngredientPayload {
  return {
    ingredient_id: payload.inventoryItemId,
    quantity_required: payload.quantityRequired,
    unit_id: payload.unitId,
    wastage_percentage: payload.wastagePercentage,
    notes: payload.notes,
    sort_order: payload.sortOrder,
  };
}

function packagingPayload(payload: RecipePackagingPayload): BackendPackagingPayload {
  return {
    packaging_item_id: payload.packagingItemId,
    quantity_required: payload.quantityRequired,
    unit_id: payload.unitId,
    is_optional: payload.isOptional,
    sort_order: payload.sortOrder,
  };
}

function newProductVariantPayload(
  payload: RecipeNewProductVariantPayload,
): BackendNewProductVariantPayload {
  return {
    variant_name: payload.variantName,
    ...(payload.sku !== null ? { sku: payload.sku } : {}),
    sale_price: payload.salePrice,
  };
}

function recipePayload(payload: CreateRecipePayload | UpdateRecipePayload): BackendRecipePayload {
  return {
    ...(payload.productId !== undefined ? { product_id: payload.productId } : {}),
    ...(payload.productVariantId !== undefined
      ? { product_variant_id: payload.productVariantId }
      : {}),
    ...(payload.newProductVariant !== undefined
      ? {
          new_product_variant:
            payload.newProductVariant === null
              ? null
              : newProductVariantPayload(payload.newProductVariant),
        }
      : {}),
    ...(payload.recipeName !== undefined ? { recipe_name: payload.recipeName } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.batchYieldQuantity !== undefined
      ? { batch_yield_quantity: payload.batchYieldQuantity }
      : {}),
    ...(payload.batchYieldUnitId !== undefined
      ? { batch_yield_unit_id: payload.batchYieldUnitId }
      : {}),
    ...(payload.preparationTimeMinutes !== undefined
      ? { preparation_time_minutes: payload.preparationTimeMinutes }
      : {}),
    ...(payload.instructions !== undefined ? { instructions: payload.instructions } : {}),
    ...(payload.ingredients !== undefined
      ? { ingredients: payload.ingredients.map(ingredientPayload) }
      : {}),
    ...(payload.packaging !== undefined
      ? { packaging: payload.packaging.map(packagingPayload) }
      : {}),
  };
}

export async function getRecipes(params: RecipeFilters): Promise<Recipe[]> {
  const response = await apiRequest<Recipe[]>(
    `/api/v1/recipes${queryString({
      search: params.search,
      product_id: params.productId,
      status: params.status,
      is_active: params.active,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseRecipe),
    },
  );

  return response.data;
}

export async function createRecipe(payload: CreateRecipePayload): Promise<Recipe> {
  const response = await apiRequest<Recipe, BackendRecipePayload>("/api/v1/recipes", {
    authMode: "appwrite",
    method: "POST",
    body: recipePayload(payload),
    parse: parseRecipe,
  });

  return response.data;
}

export async function getRecipeById(id: string): Promise<Recipe> {
  const response = await apiRequest<Recipe>(`/api/v1/recipes/${id}`, {
    authMode: "appwrite",
    parse: parseRecipe,
  });

  return response.data;
}

export async function updateRecipe(id: string, payload: UpdateRecipePayload): Promise<Recipe> {
  const response = await apiRequest<Recipe, BackendRecipePayload>(`/api/v1/recipes/${id}`, {
    authMode: "appwrite",
    method: "PATCH",
    body: recipePayload(payload),
    parse: parseRecipe,
  });

  return response.data;
}

export async function updateRecipeStatus(
  id: string,
  payload: UpdateRecipeStatusPayload,
): Promise<Recipe> {
  const response = await apiRequest<Recipe, { status: RecipeStatus; is_active?: boolean }>(
    `/api/v1/recipes/${id}/status`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: {
        status: payload.status,
        ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
      },
      parse: parseRecipe,
    },
  );

  return response.data;
}

export async function deleteRecipe(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/recipes/${id}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getRecipeIngredients(id: string): Promise<RecipeIngredientLine[]> {
  const response = await apiRequest<RecipeIngredientLine[]>(`/api/v1/recipes/${id}/ingredients`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseIngredientLine),
  });

  return response.data;
}

export async function addRecipeIngredient(
  id: string,
  payload: RecipeIngredientPayload,
): Promise<RecipeIngredientLine> {
  const response = await apiRequest<RecipeIngredientLine, BackendIngredientPayload>(
    `/api/v1/recipes/${id}/ingredients`,
    {
      authMode: "appwrite",
      method: "POST",
      body: ingredientPayload(payload),
      parse: parseIngredientLine,
    },
  );

  return response.data;
}

export async function updateRecipeIngredient(
  id: string,
  lineId: string,
  payload: RecipeIngredientPayload,
): Promise<RecipeIngredientLine> {
  const response = await apiRequest<RecipeIngredientLine, BackendIngredientPayload>(
    `/api/v1/recipes/${id}/ingredients/${lineId}`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: ingredientPayload(payload),
      parse: parseIngredientLine,
    },
  );

  return response.data;
}

export async function deleteRecipeIngredient(id: string, lineId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/recipes/${id}/ingredients/${lineId}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getRecipePackaging(id: string): Promise<RecipePackagingLine[]> {
  const response = await apiRequest<RecipePackagingLine[]>(`/api/v1/recipes/${id}/packaging`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parsePackagingLine),
  });

  return response.data;
}

export async function addRecipePackaging(
  id: string,
  payload: RecipePackagingPayload,
): Promise<RecipePackagingLine> {
  const response = await apiRequest<RecipePackagingLine, BackendPackagingPayload>(
    `/api/v1/recipes/${id}/packaging`,
    {
      authMode: "appwrite",
      method: "POST",
      body: packagingPayload(payload),
      parse: parsePackagingLine,
    },
  );

  return response.data;
}

export async function updateRecipePackaging(
  id: string,
  lineId: string,
  payload: RecipePackagingPayload,
): Promise<RecipePackagingLine> {
  const response = await apiRequest<RecipePackagingLine, BackendPackagingPayload>(
    `/api/v1/recipes/${id}/packaging/${lineId}`,
    {
      authMode: "appwrite",
      method: "PATCH",
      body: packagingPayload(payload),
      parse: parsePackagingLine,
    },
  );

  return response.data;
}

export async function deleteRecipePackaging(id: string, lineId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/recipes/${id}/packaging/${lineId}`, {
    authMode: "appwrite",
    method: "DELETE",
    parse: () => undefined,
  });
}

export async function getRecipeCost(id: string): Promise<RecipeCost> {
  const response = await apiRequest<RecipeCost>(`/api/v1/recipes/${id}/cost`, {
    authMode: "appwrite",
    parse: parseRecipeCost,
  });

  return response.data;
}

export async function recalculateRecipeCost(id: string): Promise<RecipeCost> {
  const response = await apiRequest<RecipeCost>(`/api/v1/recipes/${id}/recalculate-cost`, {
    authMode: "appwrite",
    method: "POST",
    parse: parseRecipeCost,
  });

  return response.data;
}

export async function getRecipeVersions(id: string): Promise<RecipeVersion[]> {
  const response = await apiRequest<RecipeVersion[]>(`/api/v1/recipes/${id}/versions`, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseVersion),
  });

  return response.data;
}

export async function createRecipeVersion(
  id: string,
  payload: CreateRecipeVersionPayload,
): Promise<RecipeVersion> {
  const response = await apiRequest<RecipeVersion, { change_note: string | null }>(
    `/api/v1/recipes/${id}/create-version`,
    {
      authMode: "appwrite",
      method: "POST",
      body: { change_note: payload.changeNote },
      parse: parseVersion,
    },
  );

  return response.data;
}

export async function getRecipeByProduct(productId: string): Promise<Recipe> {
  const response = await apiRequest<Recipe>(`/api/v1/recipes/product/${productId}`, {
    authMode: "appwrite",
    parse: parseRecipe,
  });

  return response.data;
}

export async function lookupRecipes(search: string): Promise<Recipe[]> {
  const response = await apiRequest<Recipe[]>(
    `/api/v1/recipes/lookup${queryString({ search, limit: 20 })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseRecipe),
    },
  );

  return response.data;
}

export async function getRecipeProducts(): Promise<RecipeProductOption[]> {
  const response = await apiRequest<RecipeProductOption[]>("/api/v1/products?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseProductOption),
  });

  return response.data;
}

export async function getRecipeInventoryItems(): Promise<RecipeInventoryItemOption[]> {
  const response = await apiRequest<RecipeInventoryItemOption[]>("/api/v1/ingredients?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseInventoryOption),
  });

  return response.data;
}

export async function getRecipePackagingItems(): Promise<RecipePackagingOption[]> {
  const response = await apiRequest<RecipePackagingOption[]>("/api/v1/packaging?limit=100", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parsePackagingOption),
  });

  return response.data;
}

export async function getRecipeUnits(): Promise<RecipeUnitOption[]> {
  const response = await apiRequest<RecipeUnitOption[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnitOption),
  });

  return response.data;
}
