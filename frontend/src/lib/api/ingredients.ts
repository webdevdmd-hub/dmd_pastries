import { apiRequest } from "@/lib/api/client";
import { getProductCategories } from "@/lib/api/master-data";
import type {
  CreateIngredientPayload,
  Ingredient,
  IngredientCategory,
  IngredientFilters,
  IngredientLookupParams,
  IngredientStatus,
  IngredientSupplierOption,
  IngredientUnitOption,
  UpdateIngredientPayload,
  UpdateIngredientStatusPayload,
} from "@/types/ingredient";

type BackendIngredientPayload = {
  ingredient_name?: string;
  ingredient_category_id?: string;
  supplier_id?: string | null;
  unit_id?: string;
  cost_per_unit?: number;
  is_stock_tracked?: boolean;
  is_expiry_tracked?: boolean;
  reorder_level?: number;
  description?: string | null;
  image_url?: string | null;
  image_file_id?: string | null;
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

function nestedString(value: unknown, keys: string[]): string | null {
  if (!isObject(value)) return null;

  for (const key of keys) {
    const nextValue = value[key];
    if (typeof nextValue === "string" && nextValue.trim().length > 0) {
      return nextValue;
    }
  }

  return null;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isIngredientStatus(value: unknown): value is IngredientStatus {
  return value === "active" || value === "inactive";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) return value.map(parser);
  if (isObject(value) && Array.isArray(value.items)) return value.items.map(parser);
  if (isObject(value) && Array.isArray(value.ingredients)) return value.ingredients.map(parser);
  if (isObject(value) && Array.isArray(value.data)) return value.data.map(parser);
  throw new Error("Backend list payload is invalid.");
}

function parseIngredient(value: unknown): Ingredient {
  if (!isObject(value)) {
    throw new Error("Backend ingredient payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    ingredientCode: stringValue(value.ingredient_code, "Ingredient"),
    ingredientName: stringValue(value.ingredient_name, "Unnamed ingredient"),
    ingredientCategoryId:
      optionalString(value.ingredient_category_id) ??
      nestedString(value.ingredient_category, ["id"]) ??
      nestedString(value.category, ["id"]) ??
      "",
    ingredientCategoryName:
      optionalString(value.ingredient_category_name) ??
      optionalString(value.category_name) ??
      nestedString(value.ingredient_category, ["category_name", "name"]) ??
      nestedString(value.category, ["category_name", "name"]) ??
      "Uncategorized",
    supplierId: optionalString(value.supplier_id),
    supplierName: optionalString(value.supplier_name),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    costPerUnit: numberValue(value.cost_per_unit),
    isStockTracked: booleanValue(value.is_stock_tracked),
    isExpiryTracked: booleanValue(value.is_expiry_tracked),
    reorderLevel: numberValue(value.reorder_level),
    description: optionalString(value.description),
    imageUrl: optionalString(value.image_url),
    imageFileId: optionalString(value.image_file_id),
    status: isIngredientStatus(value.status) ? value.status : "active",
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseSupplierOption(value: unknown): IngredientSupplierOption {
  if (!isObject(value)) {
    throw new Error("Backend supplier lookup payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
  };
}

function parseUnitOption(value: unknown): IngredientUnitOption {
  if (!isObject(value)) {
    throw new Error("Backend unit payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    unitName: stringValue(value.unit_name, "Unit"),
    symbol: stringValue(value.symbol),
  };
}

function toQueryString(params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function ingredientPayload(
  payload: CreateIngredientPayload | UpdateIngredientPayload,
): BackendIngredientPayload {
  const nextPayload: BackendIngredientPayload = {};

  if (payload.ingredientName !== undefined) nextPayload.ingredient_name = payload.ingredientName;
  if (payload.ingredientCategoryId !== undefined) {
    nextPayload.ingredient_category_id = payload.ingredientCategoryId;
  }
  if (payload.supplierId !== undefined) nextPayload.supplier_id = payload.supplierId;
  if (payload.unitId !== undefined) nextPayload.unit_id = payload.unitId;
  if (payload.costPerUnit !== undefined) nextPayload.cost_per_unit = payload.costPerUnit;
  if (payload.isStockTracked !== undefined) {
    nextPayload.is_stock_tracked = payload.isStockTracked;
  }
  if (payload.isExpiryTracked !== undefined) {
    nextPayload.is_expiry_tracked = payload.isExpiryTracked;
  }
  if (payload.reorderLevel !== undefined) nextPayload.reorder_level = payload.reorderLevel;
  if (payload.description !== undefined) nextPayload.description = payload.description;
  if (payload.imageUrl !== undefined) nextPayload.image_url = payload.imageUrl;
  if (payload.imageFileId !== undefined) nextPayload.image_file_id = payload.imageFileId;

  return nextPayload;
}

export async function getIngredients(params: IngredientFilters): Promise<Ingredient[]> {
  const response = await apiRequest<Ingredient[]>(
    `/api/v1/ingredients${toQueryString({
      search: params.search,
      ingredient_category_id: params.categoryId,
      supplier_id: params.supplierId,
      status: params.status,
      is_stock_tracked: params.stockTracked,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseIngredient),
    },
  );

  return response.data;
}

export async function createIngredient(payload: CreateIngredientPayload): Promise<Ingredient> {
  const response = await apiRequest<Ingredient, BackendIngredientPayload>("/api/v1/ingredients", {
    method: "POST",
    authMode: "appwrite",
    body: ingredientPayload(payload),
    parse: parseIngredient,
  });

  return response.data;
}

export async function getIngredientById(id: string): Promise<Ingredient> {
  const response = await apiRequest<Ingredient>(`/api/v1/ingredients/${id}`, {
    authMode: "appwrite",
    parse: parseIngredient,
  });

  return response.data;
}

export async function updateIngredient(
  id: string,
  payload: UpdateIngredientPayload,
): Promise<Ingredient> {
  const response = await apiRequest<Ingredient, BackendIngredientPayload>(
    `/api/v1/ingredients/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: ingredientPayload(payload),
      parse: parseIngredient,
    },
  );

  return response.data;
}

export async function updateIngredientStatus(
  id: string,
  payload: UpdateIngredientStatusPayload,
): Promise<Ingredient> {
  const response = await apiRequest<Ingredient, UpdateIngredientStatusPayload>(
    `/api/v1/ingredients/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseIngredient,
    },
  );

  return response.data;
}

export async function deleteIngredient(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/ingredients/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function lookupIngredients(params: IngredientLookupParams): Promise<Ingredient[]> {
  const response = await apiRequest<Ingredient[]>(
    `/api/v1/ingredients/lookup${toQueryString({
      search: params.search,
      limit: params.limit,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseIngredient),
    },
  );

  return response.data;
}

export async function getIngredientCategories(): Promise<IngredientCategory[]> {
  const categories = await getProductCategories({ productType: "ingredient" });

  return categories.map((category) => ({
    categoryName: category.categoryName,
    description: category.description,
    id: category.id,
    status: category.status,
  }));
}

export async function lookupIngredientSuppliers(search = ""): Promise<IngredientSupplierOption[]> {
  const response = await apiRequest<IngredientSupplierOption[]>(
    `/api/v1/suppliers/lookup${toQueryString({ search, limit: 20 })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplierOption),
    },
  );

  return response.data;
}

export async function getIngredientUnits(): Promise<IngredientUnitOption[]> {
  const response = await apiRequest<IngredientUnitOption[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnitOption),
  });

  return response.data;
}
