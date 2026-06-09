import { apiRequest } from "@/lib/api/client";
import { getProductCategories } from "@/lib/api/master-data";
import type {
  CreatePackagingPayload,
  CreatePackagingUsagePayload,
  PackagingCategory,
  PackagingFilters,
  PackagingItem,
  PackagingLookupParams,
  PackagingStatus,
  PackagingSupplierOption,
  PackagingUnitOption,
  PackagingUsageRule,
  UpdatePackagingPayload,
  UpdatePackagingStatusPayload,
} from "@/types/packaging";

type BackendPackagingPayload = {
  packaging_name?: string;
  packaging_category_id?: string;
  supplier_id?: string | null;
  unit_id?: string;
  cost_per_unit?: number;
  is_stock_tracked?: boolean;
  is_consumable?: boolean;
  reorder_level?: number;
  description?: string | null;
  image_url?: string | null;
  image_file_id?: string | null;
};

type BackendPackagingUsagePayload = {
  packaging_item_id?: string;
  quantity_required?: number;
  is_default?: boolean;
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

function isPackagingStatus(value: unknown): value is PackagingStatus {
  return value === "active" || value === "inactive";
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (isObject(value) && Array.isArray(value.packaging)) {
    return value.packaging.map(parser);
  }

  if (isObject(value) && Array.isArray(value.rules)) {
    return value.rules.map(parser);
  }

  if (isObject(value) && Array.isArray(value.data)) {
    return value.data.map(parser);
  }

  throw new Error("Backend list payload is invalid.");
}

function parsePackaging(value: unknown): PackagingItem {
  if (!isObject(value)) {
    throw new Error("Backend packaging payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    businessId: stringValue(value.business_id),
    packagingCode: stringValue(value.packaging_code, "Packaging"),
    packagingName: stringValue(value.packaging_name, "Unnamed packaging"),
    packagingCategoryId:
      optionalString(value.packaging_category_id) ??
      nestedString(value.packaging_category, ["id"]) ??
      nestedString(value.category, ["id"]) ??
      "",
    packagingCategoryName:
      optionalString(value.packaging_category_name) ??
      optionalString(value.category_name) ??
      nestedString(value.packaging_category, ["category_name", "name"]) ??
      nestedString(value.category, ["category_name", "name"]) ??
      "Uncategorized",
    supplierId: optionalString(value.supplier_id),
    supplierName: optionalString(value.supplier_name),
    unitId: stringValue(value.unit_id),
    unitName: stringValue(value.unit_name, "Unit"),
    unitSymbol: stringValue(value.unit_symbol),
    costPerUnit: numberValue(value.cost_per_unit),
    isStockTracked: booleanValue(value.is_stock_tracked),
    isConsumable: booleanValue(value.is_consumable, true),
    reorderLevel: numberValue(value.reorder_level),
    description: optionalString(value.description),
    imageUrl: optionalString(value.image_url),
    imageFileId: optionalString(value.image_file_id),
    status: isPackagingStatus(value.status) ? value.status : "active",
    createdByUserName: stringValue(value.created_by_user_name, "User"),
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  };
}

function parseUsageRule(value: unknown): PackagingUsageRule {
  if (!isObject(value)) {
    throw new Error("Backend packaging usage payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    productId: stringValue(value.product_id),
    productName: stringValue(value.product_name, "Product"),
    packagingItemId: stringValue(value.packaging_item_id),
    packagingName: stringValue(value.packaging_name, "Packaging"),
    quantityRequired: numberValue(value.quantity_required),
    isDefault: booleanValue(value.is_default),
    createdAt: stringValue(value.created_at),
  };
}

function parseSupplierOption(value: unknown): PackagingSupplierOption {
  if (!isObject(value)) {
    throw new Error("Backend supplier lookup payload is invalid.");
  }

  return {
    id: stringValue(value.id),
    supplierName: stringValue(value.supplier_name, "Supplier"),
  };
}

function parseUnitOption(value: unknown): PackagingUnitOption {
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

function packagingPayload(
  payload: CreatePackagingPayload | UpdatePackagingPayload,
): BackendPackagingPayload {
  const nextPayload: BackendPackagingPayload = {};

  if (payload.packagingName !== undefined) nextPayload.packaging_name = payload.packagingName;
  if (payload.packagingCategoryId !== undefined) {
    nextPayload.packaging_category_id = payload.packagingCategoryId;
  }
  if (payload.supplierId !== undefined) nextPayload.supplier_id = payload.supplierId;
  if (payload.unitId !== undefined) nextPayload.unit_id = payload.unitId;
  if (payload.costPerUnit !== undefined) nextPayload.cost_per_unit = payload.costPerUnit;
  if (payload.isStockTracked !== undefined) {
    nextPayload.is_stock_tracked = payload.isStockTracked;
  }
  if (payload.isConsumable !== undefined) nextPayload.is_consumable = payload.isConsumable;
  if (payload.reorderLevel !== undefined) nextPayload.reorder_level = payload.reorderLevel;
  if (payload.description !== undefined) nextPayload.description = payload.description;
  if (payload.imageUrl !== undefined) nextPayload.image_url = payload.imageUrl;
  if (payload.imageFileId !== undefined) nextPayload.image_file_id = payload.imageFileId;

  return nextPayload;
}

function usagePayload(payload: CreatePackagingUsagePayload): BackendPackagingUsagePayload {
  return {
    packaging_item_id: payload.packagingItemId,
    quantity_required: payload.quantityRequired,
    is_default: payload.isDefault,
  };
}

export async function getPackaging(params: PackagingFilters): Promise<PackagingItem[]> {
  const response = await apiRequest<PackagingItem[]>(
    `/api/v1/packaging${toQueryString({
      search: params.search,
      packaging_category_id: params.categoryId,
      supplier_id: params.supplierId,
      status: params.status,
      is_stock_tracked: params.stockTracked,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePackaging),
    },
  );

  return response.data;
}

export async function createPackaging(payload: CreatePackagingPayload): Promise<PackagingItem> {
  const response = await apiRequest<PackagingItem, BackendPackagingPayload>("/api/v1/packaging", {
    method: "POST",
    authMode: "appwrite",
    body: packagingPayload(payload),
    parse: parsePackaging,
  });

  return response.data;
}

export async function getPackagingById(id: string): Promise<PackagingItem> {
  const response = await apiRequest<PackagingItem>(`/api/v1/packaging/${id}`, {
    authMode: "appwrite",
    parse: parsePackaging,
  });

  return response.data;
}

export async function updatePackaging(
  id: string,
  payload: UpdatePackagingPayload,
): Promise<PackagingItem> {
  const response = await apiRequest<PackagingItem, BackendPackagingPayload>(
    `/api/v1/packaging/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: packagingPayload(payload),
      parse: parsePackaging,
    },
  );

  return response.data;
}

export async function updatePackagingStatus(
  id: string,
  payload: UpdatePackagingStatusPayload,
): Promise<PackagingItem> {
  const response = await apiRequest<PackagingItem, UpdatePackagingStatusPayload>(
    `/api/v1/packaging/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parsePackaging,
    },
  );

  return response.data;
}

export async function deletePackaging(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/packaging/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function lookupPackaging(params: PackagingLookupParams): Promise<PackagingItem[]> {
  const response = await apiRequest<PackagingItem[]>(
    `/api/v1/packaging/lookup${toQueryString({
      search: params.search,
      limit: params.limit,
    })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parsePackaging),
    },
  );

  return response.data;
}

export async function getPackagingUsage(productId: string): Promise<PackagingUsageRule[]> {
  const response = await apiRequest<PackagingUsageRule[]>(
    `/api/v1/packaging/product/${productId}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseUsageRule),
    },
  );

  return response.data;
}

export async function createPackagingUsage(
  productId: string,
  payload: CreatePackagingUsagePayload,
): Promise<PackagingUsageRule> {
  const response = await apiRequest<PackagingUsageRule, BackendPackagingUsagePayload>(
    `/api/v1/packaging/product/${productId}`,
    {
      method: "POST",
      authMode: "appwrite",
      body: usagePayload(payload),
      parse: parseUsageRule,
    },
  );

  return response.data;
}

export async function deletePackagingUsage(productId: string, ruleId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/packaging/product/${productId}/${ruleId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getPackagingCategories(): Promise<PackagingCategory[]> {
  const categories = await getProductCategories({ productType: "packaging" });

  return categories.map((category) => ({
    categoryName: category.categoryName,
    description: category.description,
    id: category.id,
    status: category.status,
  }));
}

export async function lookupSuppliers(search = ""): Promise<PackagingSupplierOption[]> {
  const response = await apiRequest<PackagingSupplierOption[]>(
    `/api/v1/suppliers/lookup${toQueryString({ search, limit: 20 })}`,
    {
      authMode: "appwrite",
      parse: (data) => parseList(data, parseSupplierOption),
    },
  );

  return response.data;
}

export async function getUnits(): Promise<PackagingUnitOption[]> {
  const response = await apiRequest<PackagingUnitOption[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnitOption),
  });

  return response.data;
}
