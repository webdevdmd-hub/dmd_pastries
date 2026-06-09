import { apiRequest } from "@/lib/api/client";
import type {
  CategoryCopyType,
  CopyCategoriesPayload,
  CopyCategoriesResult,
  CreateOrderStatusPayload,
  CreatePaymentStatusPayload,
  CreateProductCategoryPayload,
  CreateSimpleCategoryPayload,
  CreateUnitPayload,
  ManageableSimpleCategoryCollection,
  MasterDataCollection,
  MasterDataOverview,
  OrderStatus,
  PaymentStatus,
  ProductCategory,
  SimpleCategory,
  Unit,
  UnitCategory,
  UpdateMasterDataStatusPayload,
  UpdateOrderStatusPayload,
  UpdatePaymentStatusPayload,
  UpdateProductCategoryPayload,
  UpdateSimpleCategoryPayload,
  UpdateUnitPayload,
} from "@/types/master-data";
import { PRODUCT_TYPES, type ProductType } from "@/types/product";
import type { RecordStatus } from "@/types/settings";

type BackendOverview = {
  units_count?: number;
  product_categories_count?: number;
  ingredient_categories_count?: number;
  packaging_categories_count?: number;
  order_statuses_count?: number;
  payment_statuses_count?: number;
};

type BackendUnitCategory = {
  id?: string;
  name?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendUnit = {
  id?: string;
  business_id?: string | null;
  unit_category_id?: string;
  unit_category?: unknown;
  unit_name?: string;
  symbol?: string;
  base_unit_id?: string | null;
  conversion_factor?: number;
  decimal_precision?: number;
  is_system_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendUnitPayload = {
  unit_category_id?: string;
  unit_name?: string;
  symbol?: string;
  base_unit_id?: string | null;
  conversion_factor?: number;
  decimal_precision?: number;
};

type BackendProductCategory = {
  allowed_product_types?: unknown;
  id?: string;
  business_id?: string;
  parent_category_id?: string | null;
  category_name?: string;
  category_code?: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendProductCategoryPayload = {
  allowed_product_types?: ProductType[];
  parent_category_id?: string | null;
  category_name?: string;
  category_code?: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
};

type BackendCopyCategoriesPayload = {
  category_type: CategoryCopyType;
  source_branch_id: string;
};

type BackendCopyCategoriesResult = {
  category_type?: string;
  source_branch_id?: string;
  target_branch_id?: string;
  created_count?: number;
  skipped_count?: number;
  created_category_ids?: unknown;
  skipped_categories?: unknown;
};

type BackendSimpleCategory = {
  id?: string;
  business_id?: string;
  category_name?: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendSimpleCategoryPayload = {
  category_name?: string;
  description?: string;
};

type BackendOrderStatus = {
  id?: string;
  business_id?: string | null;
  status_name?: string;
  status_key?: string;
  sort_order?: number;
  color?: string;
  is_system_default?: boolean;
  is_final_status?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendOrderStatusPayload = {
  status_name?: string;
  status_key?: string;
  sort_order?: number;
  color?: string;
  is_final_status?: boolean;
};

type BackendPaymentStatus = {
  id?: string;
  business_id?: string | null;
  status_name?: string;
  status_key?: string;
  color?: string;
  is_system_default?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendPaymentStatusPayload = {
  status_name?: string;
  status_key?: string;
  color?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordStatus(value: unknown): value is RecordStatus {
  return value === "active" || value === "inactive";
}

function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.includes(value as ProductType);
}

function parseAllowedProductTypes(value: unknown): ProductType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isProductType);
}

function isCategoryCopyType(value: unknown): value is CategoryCopyType {
  return (
    value === "product_categories" ||
    value === "ingredient_categories" ||
    value === "packaging_categories"
  );
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new Error(message);
  }

  return value;
}

function requiredNumber(value: unknown, message: string): number {
  if (typeof value !== "number") {
    throw new Error(message);
  }

  return value;
}

function requiredBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(message);
  }

  return value;
}

function parseOverview(value: unknown): MasterDataOverview {
  if (!isObject(value)) {
    throw new Error("Backend master data overview payload is invalid.");
  }

  const overview = value as BackendOverview;

  return {
    unitsCount: requiredNumber(overview.units_count, "Units count is missing."),
    productCategoriesCount: requiredNumber(
      overview.product_categories_count,
      "Product categories count is missing.",
    ),
    ingredientCategoriesCount:
      typeof overview.ingredient_categories_count === "number"
        ? overview.ingredient_categories_count
        : 0,
    packagingCategoriesCount:
      typeof overview.packaging_categories_count === "number"
        ? overview.packaging_categories_count
        : 0,
    orderStatusesCount: requiredNumber(
      overview.order_statuses_count,
      "Order statuses count is missing.",
    ),
    paymentStatusesCount: requiredNumber(
      overview.payment_statuses_count,
      "Payment statuses count is missing.",
    ),
  };
}

function parseUnitCategory(value: unknown): UnitCategory {
  if (!isObject(value)) {
    throw new Error("Backend unit category payload is invalid.");
  }

  const category = value as BackendUnitCategory;

  return {
    id: requiredString(category.id, "Unit category ID is missing."),
    name: requiredString(category.name, "Unit category name is missing."),
    description: requiredString(category.description, "Unit category description is missing."),
    createdAt: requiredString(category.created_at, "Unit category created date is missing."),
    updatedAt: requiredString(category.updated_at, "Unit category updated date is missing."),
  };
}

function parseUnit(value: unknown): Unit {
  if (!isObject(value)) {
    throw new Error("Backend unit payload is invalid.");
  }

  const unit = value as BackendUnit;

  if (!isRecordStatus(unit.status)) {
    throw new Error("Backend unit payload is missing status.");
  }

  return {
    id: requiredString(unit.id, "Unit ID is missing."),
    businessId: typeof unit.business_id === "string" ? unit.business_id : null,
    unitCategoryId: requiredString(unit.unit_category_id, "Unit category ID is missing."),
    unitCategory: parseUnitCategory(unit.unit_category),
    unitName: requiredString(unit.unit_name, "Unit name is missing."),
    symbol: requiredString(unit.symbol, "Unit symbol is missing."),
    baseUnitId: typeof unit.base_unit_id === "string" ? unit.base_unit_id : null,
    conversionFactor: requiredNumber(unit.conversion_factor, "Conversion factor is missing."),
    decimalPrecision: requiredNumber(unit.decimal_precision, "Decimal precision is missing."),
    isSystemDefault: requiredBoolean(unit.is_system_default, "System default flag is missing."),
    status: unit.status,
    createdAt: requiredString(unit.created_at, "Unit created date is missing."),
    updatedAt: requiredString(unit.updated_at, "Unit updated date is missing."),
  };
}

function parseProductCategory(value: unknown): ProductCategory {
  if (!isObject(value)) {
    throw new Error("Backend product category payload is invalid.");
  }

  const category = value as BackendProductCategory;

  if (!isRecordStatus(category.status)) {
    throw new Error("Backend product category payload is missing status.");
  }

  return {
    allowedProductTypes: parseAllowedProductTypes(category.allowed_product_types),
    id: requiredString(category.id, "Product category ID is missing."),
    businessId: requiredString(category.business_id, "Product category business ID is missing."),
    parentCategoryId:
      typeof category.parent_category_id === "string" ? category.parent_category_id : null,
    categoryName: requiredString(category.category_name, "Product category name is missing."),
    categoryCode: requiredString(category.category_code, "Product category code is missing."),
    description: requiredString(category.description, "Product category description is missing."),
    imageUrl: typeof category.image_url === "string" ? category.image_url : "",
    sortOrder: requiredNumber(category.sort_order, "Product category sort order is missing."),
    status: category.status,
    createdAt: requiredString(category.created_at, "Product category created date is missing."),
    updatedAt: requiredString(category.updated_at, "Product category updated date is missing."),
  };
}

function parseSimpleCategory(value: unknown): SimpleCategory {
  if (!isObject(value)) {
    throw new Error("Backend simple category payload is invalid.");
  }

  const category = value as BackendSimpleCategory;

  if (!isRecordStatus(category.status)) {
    throw new Error("Backend simple category payload is missing status.");
  }

  return {
    id: requiredString(category.id, "Category ID is missing."),
    businessId: requiredString(category.business_id, "Category business ID is missing."),
    categoryName: requiredString(category.category_name, "Category name is missing."),
    description: requiredString(category.description, "Category description is missing."),
    status: category.status,
    createdAt: requiredString(category.created_at, "Category created date is missing."),
    updatedAt: requiredString(category.updated_at, "Category updated date is missing."),
  };
}

function parseOrderStatus(value: unknown): OrderStatus {
  if (!isObject(value)) {
    throw new Error("Backend order status payload is invalid.");
  }

  const status = value as BackendOrderStatus;

  if (!isRecordStatus(status.status)) {
    throw new Error("Backend order status payload is missing status.");
  }

  return {
    id: requiredString(status.id, "Order status ID is missing."),
    businessId: typeof status.business_id === "string" ? status.business_id : null,
    statusName: requiredString(status.status_name, "Order status name is missing."),
    statusKey: requiredString(status.status_key, "Order status key is missing."),
    sortOrder: requiredNumber(status.sort_order, "Order status sort order is missing."),
    color: requiredString(status.color, "Order status color is missing."),
    isSystemDefault: requiredBoolean(status.is_system_default, "System default flag is missing."),
    isFinalStatus: requiredBoolean(status.is_final_status, "Final status flag is missing."),
    status: status.status,
    createdAt: requiredString(status.created_at, "Order status created date is missing."),
    updatedAt: requiredString(status.updated_at, "Order status updated date is missing."),
  };
}

function parsePaymentStatus(value: unknown): PaymentStatus {
  if (!isObject(value)) {
    throw new Error("Backend payment status payload is invalid.");
  }

  const status = value as BackendPaymentStatus;

  if (!isRecordStatus(status.status)) {
    throw new Error("Backend payment status payload is missing status.");
  }

  return {
    id: requiredString(status.id, "Payment status ID is missing."),
    businessId: typeof status.business_id === "string" ? status.business_id : null,
    statusName: requiredString(status.status_name, "Payment status name is missing."),
    statusKey: requiredString(status.status_key, "Payment status key is missing."),
    color: requiredString(status.color, "Payment status color is missing."),
    isSystemDefault: requiredBoolean(status.is_system_default, "System default flag is missing."),
    status: status.status,
    createdAt: requiredString(status.created_at, "Payment status created date is missing."),
    updatedAt: requiredString(status.updated_at, "Payment status updated date is missing."),
  };
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseSkippedCategories(value: unknown): CopyCategoriesResult["skippedCategories"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map((category) => ({
    categoryName:
      typeof category.category_name === "string" ? category.category_name : "Unnamed category",
    reason: typeof category.reason === "string" ? category.reason : "skipped",
  }));
}

function parseCopyCategoriesResult(value: unknown): CopyCategoriesResult {
  if (!isObject(value)) {
    throw new Error("Backend category copy payload is invalid.");
  }

  const result = value as BackendCopyCategoriesResult;

  if (!isCategoryCopyType(result.category_type)) {
    throw new Error("Backend category copy payload is missing category type.");
  }

  return {
    categoryType: result.category_type,
    sourceBranchId: requiredString(result.source_branch_id, "Source branch ID is missing."),
    targetBranchId: requiredString(result.target_branch_id, "Target branch ID is missing."),
    createdCount: requiredNumber(result.created_count, "Created count is missing."),
    skippedCount: requiredNumber(result.skipped_count, "Skipped count is missing."),
    createdCategoryIds: parseStringList(result.created_category_ids),
    skippedCategories: parseSkippedCategories(result.skipped_categories),
  };
}

function parseList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (!Array.isArray(value)) {
    throw new Error("Backend list payload is invalid.");
  }

  return value.map(parser);
}

const collectionPaths: Record<MasterDataCollection, string> = {
  units: "/api/v1/master-data/units",
  "product-categories": "/api/v1/master-data/product-categories",
  "ingredient-categories": "/api/v1/master-data/ingredient-categories",
  "packaging-categories": "/api/v1/master-data/packaging-categories",
  "order-statuses": "/api/v1/master-data/order-statuses",
  "payment-statuses": "/api/v1/master-data/payment-statuses",
};

export async function getMasterDataOverview(): Promise<MasterDataOverview> {
  const response = await apiRequest<MasterDataOverview>("/api/v1/master-data/overview", {
    authMode: "appwrite",
    parse: parseOverview,
  });

  return response.data;
}

export async function getUnitCategories(): Promise<UnitCategory[]> {
  const response = await apiRequest<UnitCategory[]>("/api/v1/master-data/unit-categories", {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnitCategory),
  });

  return response.data;
}

export async function getUnits(): Promise<Unit[]> {
  const response = await apiRequest<Unit[]>(collectionPaths.units, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseUnit),
  });

  return response.data;
}

function toBackendUnitPayload(payload: CreateUnitPayload | UpdateUnitPayload): BackendUnitPayload {
  return {
    ...(payload.unitCategoryId !== undefined ? { unit_category_id: payload.unitCategoryId } : {}),
    ...(payload.unitName !== undefined ? { unit_name: payload.unitName } : {}),
    ...(payload.symbol !== undefined ? { symbol: payload.symbol } : {}),
    ...(payload.baseUnitId !== undefined ? { base_unit_id: payload.baseUnitId } : {}),
    ...(payload.conversionFactor !== undefined
      ? { conversion_factor: payload.conversionFactor }
      : {}),
    ...(payload.decimalPrecision !== undefined
      ? { decimal_precision: payload.decimalPrecision }
      : {}),
  };
}

export async function getUnitById(id: string): Promise<Unit> {
  const response = await apiRequest<Unit>(`${collectionPaths.units}/${id}`, {
    authMode: "appwrite",
    parse: parseUnit,
  });

  return response.data;
}

export async function createUnit(payload: CreateUnitPayload): Promise<Unit> {
  const response = await apiRequest<Unit, BackendUnitPayload>(collectionPaths.units, {
    method: "POST",
    authMode: "appwrite",
    body: toBackendUnitPayload(payload),
    parse: parseUnit,
  });

  return response.data;
}

export async function updateUnit(id: string, payload: UpdateUnitPayload): Promise<Unit> {
  const response = await apiRequest<Unit, BackendUnitPayload>(`${collectionPaths.units}/${id}`, {
    method: "PATCH",
    authMode: "appwrite",
    body: toBackendUnitPayload(payload),
    parse: parseUnit,
  });

  return response.data;
}

export async function updateUnitStatus(
  id: string,
  payload: UpdateMasterDataStatusPayload,
): Promise<Unit> {
  const response = await apiRequest<Unit, UpdateMasterDataStatusPayload>(
    `${collectionPaths.units}/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseUnit,
    },
  );

  return response.data;
}

export async function deleteUnit(id: string): Promise<void> {
  await apiRequest<void>(`${collectionPaths.units}/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export type ProductCategoryFilters = {
  productType?: ProductType | "all";
};

export async function getProductCategories(
  filters: ProductCategoryFilters = {},
): Promise<ProductCategory[]> {
  const searchParams = new URLSearchParams();

  if (filters.productType && filters.productType !== "all") {
    searchParams.set("product_type", filters.productType);
  }

  const query = searchParams.toString();
  const url = `${collectionPaths["product-categories"]}${query ? `?${query}` : ""}`;

  const response = await apiRequest<ProductCategory[]>(url, {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseProductCategory),
  });

  return response.data;
}

function toBackendProductCategoryPayload(
  payload: CreateProductCategoryPayload | UpdateProductCategoryPayload,
): BackendProductCategoryPayload {
  return {
    ...(payload.allowedProductTypes !== undefined
      ? { allowed_product_types: payload.allowedProductTypes }
      : {}),
    ...(payload.parentCategoryId !== undefined
      ? { parent_category_id: payload.parentCategoryId }
      : {}),
    ...(payload.categoryName !== undefined ? { category_name: payload.categoryName } : {}),
    ...(payload.categoryCode !== undefined ? { category_code: payload.categoryCode } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
  };
}

export async function getProductCategoryById(id: string): Promise<ProductCategory> {
  const response = await apiRequest<ProductCategory>(
    `/api/v1/master-data/product-categories/${id}`,
    {
      authMode: "appwrite",
      parse: parseProductCategory,
    },
  );

  return response.data;
}

export async function createProductCategory(
  payload: CreateProductCategoryPayload,
): Promise<ProductCategory> {
  const response = await apiRequest<ProductCategory, BackendProductCategoryPayload>(
    "/api/v1/master-data/product-categories",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendProductCategoryPayload(payload),
      parse: parseProductCategory,
    },
  );

  return response.data;
}

export async function updateProductCategory(
  id: string,
  payload: UpdateProductCategoryPayload,
): Promise<ProductCategory> {
  const response = await apiRequest<ProductCategory, BackendProductCategoryPayload>(
    `/api/v1/master-data/product-categories/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendProductCategoryPayload(payload),
      parse: parseProductCategory,
    },
  );

  return response.data;
}

export async function updateProductCategoryStatus(
  id: string,
  payload: UpdateMasterDataStatusPayload,
): Promise<ProductCategory> {
  const response = await apiRequest<ProductCategory, UpdateMasterDataStatusPayload>(
    `/api/v1/master-data/product-categories/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseProductCategory,
    },
  );

  return response.data;
}

export async function deleteProductCategory(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/master-data/product-categories/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function copyCategories(
  payload: CopyCategoriesPayload,
): Promise<CopyCategoriesResult> {
  const response = await apiRequest<CopyCategoriesResult, BackendCopyCategoriesPayload>(
    "/api/v1/master-data/categories/copy",
    {
      method: "POST",
      authMode: "appwrite",
      body: {
        category_type: payload.categoryType,
        source_branch_id: payload.sourceBranchId,
      },
      parse: parseCopyCategoriesResult,
    },
  );

  return response.data;
}

export async function getSimpleCategories(
  collection: Extract<MasterDataCollection, "ingredient-categories" | "packaging-categories">,
): Promise<SimpleCategory[]> {
  const response = await apiRequest<SimpleCategory[]>(collectionPaths[collection], {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseSimpleCategory),
  });

  return response.data;
}

function toBackendSimpleCategoryPayload(
  payload: CreateSimpleCategoryPayload | UpdateSimpleCategoryPayload,
): BackendSimpleCategoryPayload {
  return {
    ...(payload.categoryName !== undefined ? { category_name: payload.categoryName } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
  };
}

export async function getSimpleCategoryById(
  collection: ManageableSimpleCategoryCollection,
  id: string,
): Promise<SimpleCategory> {
  const response = await apiRequest<SimpleCategory>(`${collectionPaths[collection]}/${id}`, {
    authMode: "appwrite",
    parse: parseSimpleCategory,
  });

  return response.data;
}

export async function createSimpleCategory(
  collection: ManageableSimpleCategoryCollection,
  payload: CreateSimpleCategoryPayload,
): Promise<SimpleCategory> {
  const response = await apiRequest<SimpleCategory, BackendSimpleCategoryPayload>(
    collectionPaths[collection],
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendSimpleCategoryPayload(payload),
      parse: parseSimpleCategory,
    },
  );

  return response.data;
}

export async function updateSimpleCategory(
  collection: ManageableSimpleCategoryCollection,
  id: string,
  payload: UpdateSimpleCategoryPayload,
): Promise<SimpleCategory> {
  const response = await apiRequest<SimpleCategory, BackendSimpleCategoryPayload>(
    `${collectionPaths[collection]}/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendSimpleCategoryPayload(payload),
      parse: parseSimpleCategory,
    },
  );

  return response.data;
}

export async function updateSimpleCategoryStatus(
  collection: ManageableSimpleCategoryCollection,
  id: string,
  payload: UpdateMasterDataStatusPayload,
): Promise<SimpleCategory> {
  const response = await apiRequest<SimpleCategory, UpdateMasterDataStatusPayload>(
    `${collectionPaths[collection]}/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseSimpleCategory,
    },
  );

  return response.data;
}

export async function deleteSimpleCategory(
  collection: ManageableSimpleCategoryCollection,
  id: string,
): Promise<void> {
  await apiRequest<void>(`${collectionPaths[collection]}/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getOrderStatuses(): Promise<OrderStatus[]> {
  const response = await apiRequest<OrderStatus[]>(collectionPaths["order-statuses"], {
    authMode: "appwrite",
    parse: (data) => parseList(data, parseOrderStatus),
  });

  return response.data;
}

function toBackendOrderStatusPayload(
  payload: CreateOrderStatusPayload | UpdateOrderStatusPayload,
): BackendOrderStatusPayload {
  return {
    ...(payload.statusName !== undefined ? { status_name: payload.statusName } : {}),
    ...(payload.statusKey !== undefined ? { status_key: payload.statusKey } : {}),
    ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
    ...(payload.color !== undefined ? { color: payload.color } : {}),
    ...(payload.isFinalStatus !== undefined ? { is_final_status: payload.isFinalStatus } : {}),
  };
}

export async function createOrderStatus(payload: CreateOrderStatusPayload): Promise<OrderStatus> {
  const response = await apiRequest<OrderStatus, BackendOrderStatusPayload>(
    "/api/v1/master-data/order-statuses",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendOrderStatusPayload(payload),
      parse: parseOrderStatus,
    },
  );

  return response.data;
}

export async function updateOrderStatus(
  id: string,
  payload: UpdateOrderStatusPayload,
): Promise<OrderStatus> {
  const response = await apiRequest<OrderStatus, BackendOrderStatusPayload>(
    `/api/v1/master-data/order-statuses/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendOrderStatusPayload(payload),
      parse: parseOrderStatus,
    },
  );

  return response.data;
}

export async function updateOrderStatusStatus(
  id: string,
  payload: UpdateMasterDataStatusPayload,
): Promise<OrderStatus> {
  const response = await apiRequest<OrderStatus, UpdateMasterDataStatusPayload>(
    `/api/v1/master-data/order-statuses/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseOrderStatus,
    },
  );

  return response.data;
}

export async function getPaymentStatuses(): Promise<PaymentStatus[]> {
  const response = await apiRequest<PaymentStatus[]>(collectionPaths["payment-statuses"], {
    authMode: "appwrite",
    parse: (data) => parseList(data, parsePaymentStatus),
  });

  return response.data;
}

function toBackendPaymentStatusPayload(
  payload: CreatePaymentStatusPayload | UpdatePaymentStatusPayload,
): BackendPaymentStatusPayload {
  return {
    ...(payload.statusName !== undefined ? { status_name: payload.statusName } : {}),
    ...(payload.statusKey !== undefined ? { status_key: payload.statusKey } : {}),
    ...(payload.color !== undefined ? { color: payload.color } : {}),
  };
}

export async function createPaymentStatus(
  payload: CreatePaymentStatusPayload,
): Promise<PaymentStatus> {
  const response = await apiRequest<PaymentStatus, BackendPaymentStatusPayload>(
    "/api/v1/master-data/payment-statuses",
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendPaymentStatusPayload(payload),
      parse: parsePaymentStatus,
    },
  );

  return response.data;
}

export async function updatePaymentStatus(
  id: string,
  payload: UpdatePaymentStatusPayload,
): Promise<PaymentStatus> {
  const response = await apiRequest<PaymentStatus, BackendPaymentStatusPayload>(
    `/api/v1/master-data/payment-statuses/${id}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendPaymentStatusPayload(payload),
      parse: parsePaymentStatus,
    },
  );

  return response.data;
}

export async function updatePaymentStatusStatus(
  id: string,
  payload: UpdateMasterDataStatusPayload,
): Promise<PaymentStatus> {
  const response = await apiRequest<PaymentStatus, UpdateMasterDataStatusPayload>(
    `/api/v1/master-data/payment-statuses/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parsePaymentStatus,
    },
  );

  return response.data;
}
