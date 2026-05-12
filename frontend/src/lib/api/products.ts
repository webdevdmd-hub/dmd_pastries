import { apiRequest } from "@/lib/api/client";
import type { Unit } from "@/types/master-data";
import type {
  CreateProductPayload,
  CreateProductVariantPayload,
  Product,
  ProductListFilters,
  ProductListResponse,
  ProductReferenceData,
  ProductStatus,
  ProductType,
  ProductVariant,
  UpdateProductPayload,
  UpdateProductStatusPayload,
  UpdateProductVariantPayload,
  UpdateProductVariantStatusPayload,
} from "@/types/product";
import type { TaxRate } from "@/types/settings";

type BackendListResponse = {
  data?: unknown;
  items?: unknown;
  pagination?: unknown;
  total?: unknown;
  page?: unknown;
  limit?: unknown;
};

type BackendProductCategoryReference = {
  id?: unknown;
  category_name?: unknown;
  name?: unknown;
  status?: unknown;
};

type BackendUnitReference = {
  id?: unknown;
  business_id?: unknown;
  unit_category_id?: unknown;
  unit_category?: unknown;
  unit_name?: unknown;
  name?: unknown;
  symbol?: unknown;
  base_unit_id?: unknown;
  conversion_factor?: unknown;
  decimal_precision?: unknown;
  is_system_default?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type BackendTaxRateReference = {
  id?: unknown;
  business_id?: unknown;
  tax_name?: unknown;
  name?: unknown;
  tax_type?: unknown;
  rate_percentage?: unknown;
  is_inclusive?: unknown;
  country?: unknown;
  region?: unknown;
  is_default?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type BackendProduct = {
  id?: unknown;
  product_name?: unknown;
  product_code?: unknown;
  sku?: unknown;
  barcode?: unknown;
  description?: unknown;
  category?: unknown;
  category_id?: unknown;
  category_name?: unknown;
  unit?: unknown;
  unit_id?: unknown;
  unit_name?: unknown;
  tax_rate?: unknown;
  tax_rate_id?: unknown;
  tax_rate_name?: unknown;
  product_type?: unknown;
  sale_price?: unknown;
  cost_price?: unknown;
  compare_at_price?: unknown;
  image_url?: unknown;
  image_file_id?: unknown;
  is_pos_visible?: unknown;
  is_stock_tracked?: unknown;
  is_expiry_tracked?: unknown;
  is_custom_order_available?: unknown;
  preparation_time_minutes?: unknown;
  status?: unknown;
  variants?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type BackendVariant = {
  id?: unknown;
  product_id?: unknown;
  variant_name?: unknown;
  sku?: unknown;
  barcode?: unknown;
  sale_price?: unknown;
  cost_price?: unknown;
  image_url?: unknown;
  image_file_id?: unknown;
  sort_order?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type BackendProductPayload = {
  product_name?: string;
  category_id?: string;
  unit_id?: string;
  tax_rate_id?: string | null;
  product_type?: ProductType;
  sale_price?: number;
  cost_price?: number | null;
  compare_at_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  image_url?: string | null;
  image_file_id?: string | null;
  is_pos_visible?: boolean;
  is_stock_tracked?: boolean;
  is_expiry_tracked?: boolean;
  is_custom_order_available?: boolean;
  preparation_time_minutes?: number | null;
};

type BackendProductVariantPayload = {
  variant_name?: string;
  sku?: string | null;
  barcode?: string | null;
  sale_price?: number;
  cost_price?: number | null;
  image_url?: string | null;
  image_file_id?: string | null;
  sort_order?: number;
  status?: "active" | "inactive";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} is missing.`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nestedString(value: unknown, keys: string[]): string | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  for (const key of keys) {
    const item = value[key];

    if (typeof item === "string" && item.length > 0) {
      return item;
    }
  }

  return undefined;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`${field} is missing.`);
  }

  return value;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} is missing.`);
  }

  return value;
}

function optionalNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isProductStatus(value: unknown): value is ProductStatus {
  return value === "active" || value === "inactive" || value === "archived";
}

function isRecordStatus(value: unknown): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}

function isProductType(value: unknown): value is ProductType {
  return (
    value === "ready_to_sell" ||
    value === "made_to_order" ||
    value === "manufactured" ||
    value === "retail" ||
    value === "service"
  );
}

type VariantFallbacks = {
  createdAt?: string | undefined;
  productId?: string | undefined;
  updatedAt?: string | undefined;
};

function parseVariantWithFallbacks(value: unknown, fallbacks: VariantFallbacks): ProductVariant {
  if (!isObject(value)) {
    throw new Error("Product variant payload is invalid.");
  }

  const variant = value as BackendVariant;

  if (!isRecordStatus(variant.status)) {
    throw new Error("Product variant status is invalid.");
  }

  return {
    id: requiredString(variant.id, "Variant ID"),
    productId:
      optionalString(variant.product_id) ??
      fallbacks.productId ??
      requiredString(variant.product_id, "Variant product ID"),
    variantName: requiredString(variant.variant_name, "Variant name"),
    sku: nullableString(variant.sku),
    barcode: nullableString(variant.barcode),
    salePrice: requiredNumber(variant.sale_price, "Variant sale price"),
    costPrice: nullableNumber(variant.cost_price),
    imageUrl: nullableString(variant.image_url),
    imageFileId: nullableString(variant.image_file_id) ?? nullableString(variant.image_url),
    sortOrder: requiredNumber(variant.sort_order, "Variant sort order"),
    status: variant.status,
    createdAt:
      optionalString(variant.created_at) ??
      fallbacks.createdAt ??
      requiredString(variant.created_at, "Variant created at"),
    updatedAt:
      optionalString(variant.updated_at) ??
      fallbacks.updatedAt ??
      requiredString(variant.updated_at, "Variant updated at"),
  };
}

function parseVariant(value: unknown): ProductVariant {
  return parseVariantWithFallbacks(value, {});
}

function parseVariants(value: unknown, fallbacks: VariantFallbacks = {}): ProductVariant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((variant) => parseVariantWithFallbacks(variant, fallbacks));
}

function parseProduct(value: unknown): Product {
  if (!isObject(value)) {
    throw new Error("Product payload is invalid.");
  }

  const product = value as BackendProduct;

  if (!isProductType(product.product_type)) {
    throw new Error("Product type is invalid.");
  }

  if (!isProductStatus(product.status)) {
    throw new Error("Product status is invalid.");
  }

  return {
    id: requiredString(product.id, "Product ID"),
    productName: requiredString(product.product_name, "Product name"),
    productCode:
      optionalString(product.product_code) ??
      optionalString(product.sku) ??
      requiredString(product.id, "Product ID"),
    sku: nullableString(product.sku),
    barcode: nullableString(product.barcode),
    description: nullableString(product.description),
    categoryId:
      optionalString(product.category_id) ??
      nestedString(product.category, ["id", "category_id"]) ??
      "",
    categoryName:
      optionalString(product.category_name) ??
      nestedString(product.category, ["category_name", "name"]) ??
      "Unassigned category",
    unitId: optionalString(product.unit_id) ?? nestedString(product.unit, ["id", "unit_id"]) ?? "",
    unitName:
      optionalString(product.unit_name) ??
      nestedString(product.unit, ["unit_name", "name", "symbol"]) ??
      "Unassigned unit",
    taxRateId:
      nullableString(product.tax_rate_id) ??
      nestedString(product.tax_rate, ["id", "tax_rate_id"]) ??
      null,
    taxRateName:
      nullableString(product.tax_rate_name) ??
      nestedString(product.tax_rate, ["tax_name", "name"]) ??
      null,
    productType: product.product_type,
    salePrice: requiredNumber(product.sale_price, "Sale price"),
    costPrice: nullableNumber(product.cost_price),
    compareAtPrice: nullableNumber(product.compare_at_price),
    imageUrl: nullableString(product.image_url),
    imageFileId: nullableString(product.image_file_id) ?? nullableString(product.image_url),
    isPosVisible: requiredBoolean(product.is_pos_visible, "POS visible"),
    isStockTracked: requiredBoolean(product.is_stock_tracked, "Stock tracked"),
    isExpiryTracked: requiredBoolean(product.is_expiry_tracked, "Expiry tracked"),
    isCustomOrderAvailable: requiredBoolean(
      product.is_custom_order_available,
      "Custom order available",
    ),
    preparationTimeMinutes: nullableNumber(product.preparation_time_minutes),
    status: product.status,
    variants: parseVariants(product.variants, {
      createdAt: optionalString(product.created_at),
      productId: optionalString(product.id),
      updatedAt: optionalString(product.updated_at),
    }),
    createdAt: requiredString(product.created_at, "Created at"),
    updatedAt: requiredString(product.updated_at, "Updated at"),
  };
}

function parseProductsResponse(value: unknown): ProductListResponse {
  if (Array.isArray(value)) {
    return {
      items: value.map(parseProduct),
      total: value.length,
      page: 1,
      limit: value.length,
    };
  }

  if (!isObject(value)) {
    throw new Error("Products list payload is invalid.");
  }

  const payload = value as BackendListResponse;
  const itemsValue = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray((value as { data?: unknown }).data)
      ? ((value as { data?: unknown }).data as unknown[])
      : [];
  const pagination = isObject(payload.pagination) ? payload.pagination : {};
  const totalValue =
    typeof payload.total === "number"
      ? payload.total
      : typeof pagination.total === "number"
        ? pagination.total
        : itemsValue.length;
  const pageValue =
    typeof payload.page === "number"
      ? payload.page
      : typeof pagination.page === "number"
        ? pagination.page
        : 1;
  const limitValue =
    typeof payload.limit === "number"
      ? payload.limit
      : typeof pagination.limit === "number"
        ? pagination.limit
        : itemsValue.length || 20;

  return {
    items: itemsValue.map(parseProduct),
    total: totalValue,
    page: pageValue,
    limit: limitValue,
  };
}

function parseReferenceList<TItem>(value: unknown, parser: (item: unknown) => TItem): TItem[] {
  if (Array.isArray(value)) {
    return value.map(parser);
  }

  if (!isObject(value)) {
    throw new Error("Reference list payload is invalid.");
  }

  if (Array.isArray(value.items)) {
    return value.items.map(parser);
  }

  if (Array.isArray(value.data)) {
    return value.data.map(parser);
  }

  return [];
}

function parseProductCategoryReference(value: unknown): { id: string; categoryName: string } {
  if (!isObject(value)) {
    throw new Error("Product category reference payload is invalid.");
  }

  const category = value as BackendProductCategoryReference;
  const id = requiredString(category.id, "Product category ID");

  return {
    id,
    categoryName:
      optionalString(category.category_name) ?? optionalString(category.name) ?? "Unnamed category",
  };
}

function parseUnitReference(value: unknown): Unit {
  if (!isObject(value)) {
    throw new Error("Unit reference payload is invalid.");
  }

  const unit = value as BackendUnitReference;
  const id = requiredString(unit.id, "Unit ID");
  const unitCategoryId = optionalString(unit.unit_category_id) ?? "uncategorized";
  const createdAt = optionalString(unit.created_at) ?? "";
  const updatedAt = optionalString(unit.updated_at) ?? "";

  return {
    id,
    businessId: optionalString(unit.business_id) ?? null,
    unitCategoryId,
    unitCategory: {
      id: unitCategoryId,
      name: nestedString(unit.unit_category, ["name"]) ?? "Uncategorized",
      description: nestedString(unit.unit_category, ["description"]) ?? "",
      createdAt,
      updatedAt,
    },
    unitName: optionalString(unit.unit_name) ?? optionalString(unit.name) ?? "Unnamed unit",
    symbol: optionalString(unit.symbol) ?? "",
    baseUnitId: optionalString(unit.base_unit_id) ?? null,
    conversionFactor: optionalNumber(unit.conversion_factor, 1),
    decimalPrecision: optionalNumber(unit.decimal_precision, 0),
    isSystemDefault: optionalBoolean(unit.is_system_default, false),
    status: isRecordStatus(unit.status) ? unit.status : "active",
    createdAt,
    updatedAt,
  };
}

function parseTaxRateReference(value: unknown): TaxRate {
  if (!isObject(value)) {
    throw new Error("Tax rate reference payload is invalid.");
  }

  const taxRate = value as BackendTaxRateReference;
  const id = requiredString(taxRate.id, "Tax rate ID");

  return {
    id,
    businessId: optionalString(taxRate.business_id) ?? "",
    taxName: optionalString(taxRate.tax_name) ?? optionalString(taxRate.name) ?? "Unnamed tax rate",
    taxType: optionalString(taxRate.tax_type) ?? "",
    ratePercentage: optionalNumber(taxRate.rate_percentage, 0),
    isInclusive: optionalBoolean(taxRate.is_inclusive, false),
    country: optionalString(taxRate.country) ?? "",
    region: optionalString(taxRate.region) ?? "",
    isDefault: optionalBoolean(taxRate.is_default, false),
    status: isRecordStatus(taxRate.status) ? taxRate.status : "active",
    createdAt: optionalString(taxRate.created_at) ?? "",
    updatedAt: optionalString(taxRate.updated_at) ?? "",
  };
}

async function getProductCategoryReferences(): Promise<{ id: string; categoryName: string }[]> {
  const response = await apiRequest<{ id: string; categoryName: string }[]>(
    "/api/v1/master-data/product-categories",
    {
      authMode: "appwrite",
      parse: (data) => parseReferenceList(data, parseProductCategoryReference),
    },
  );

  return response.data.filter((category) => category.id.length > 0);
}

async function getUnitReferences(): Promise<Unit[]> {
  const response = await apiRequest<Unit[]>("/api/v1/master-data/units", {
    authMode: "appwrite",
    parse: (data) => parseReferenceList(data, parseUnitReference),
  });

  return response.data.filter((unit) => unit.id.length > 0);
}

async function getTaxRateReferences(): Promise<TaxRate[]> {
  const response = await apiRequest<TaxRate[]>("/api/v1/settings/tax-rates", {
    authMode: "appwrite",
    parse: (data) => parseReferenceList(data, parseTaxRateReference),
  });

  return response.data.filter((taxRate) => taxRate.id.length > 0);
}

function toBackendProductPayload(
  payload: CreateProductPayload | UpdateProductPayload,
): BackendProductPayload {
  return {
    ...(payload.productName !== undefined ? { product_name: payload.productName } : {}),
    ...(payload.categoryId !== undefined ? { category_id: payload.categoryId } : {}),
    ...(payload.unitId !== undefined ? { unit_id: payload.unitId } : {}),
    ...(payload.taxRateId !== undefined ? { tax_rate_id: payload.taxRateId } : {}),
    ...(payload.productType !== undefined ? { product_type: payload.productType } : {}),
    ...(payload.salePrice !== undefined ? { sale_price: payload.salePrice } : {}),
    ...(payload.costPrice !== undefined ? { cost_price: payload.costPrice } : {}),
    ...(payload.compareAtPrice !== undefined ? { compare_at_price: payload.compareAtPrice } : {}),
    ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
    ...(payload.barcode !== undefined ? { barcode: payload.barcode } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.imageFileId !== undefined ? { image_file_id: payload.imageFileId } : {}),
    ...(payload.isPosVisible !== undefined ? { is_pos_visible: payload.isPosVisible } : {}),
    ...(payload.isStockTracked !== undefined ? { is_stock_tracked: payload.isStockTracked } : {}),
    ...(payload.isExpiryTracked !== undefined
      ? { is_expiry_tracked: payload.isExpiryTracked }
      : {}),
    ...(payload.isCustomOrderAvailable !== undefined
      ? { is_custom_order_available: payload.isCustomOrderAvailable }
      : {}),
    ...(payload.preparationTimeMinutes !== undefined
      ? { preparation_time_minutes: payload.preparationTimeMinutes }
      : {}),
  };
}

function toBackendVariantPayload(
  payload: CreateProductVariantPayload | UpdateProductVariantPayload,
): BackendProductVariantPayload {
  return {
    ...(payload.variantName !== undefined ? { variant_name: payload.variantName } : {}),
    ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
    ...(payload.barcode !== undefined ? { barcode: payload.barcode } : {}),
    ...(payload.salePrice !== undefined ? { sale_price: payload.salePrice } : {}),
    ...(payload.costPrice !== undefined ? { cost_price: payload.costPrice } : {}),
    ...(payload.imageUrl !== undefined ? { image_url: payload.imageUrl } : {}),
    ...(payload.imageFileId !== undefined ? { image_file_id: payload.imageFileId } : {}),
    ...(payload.sortOrder !== undefined ? { sort_order: payload.sortOrder } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
  };
}

function buildProductsPath(filters: ProductListFilters): string {
  const params = new URLSearchParams();
  params.set("search", filters.search);
  if (filters.categoryId !== "all") {
    params.set("category_id", filters.categoryId);
  }
  if (filters.productType !== "all") {
    params.set("product_type", filters.productType);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.isPosVisible !== "all") {
    params.set("is_pos_visible", filters.isPosVisible);
  }
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));
  params.set("sort_by", filters.sortBy);
  params.set("sort_order", filters.sortOrder);

  return `/api/v1/products?${params.toString()}`;
}

export async function getProducts(filters: ProductListFilters): Promise<ProductListResponse> {
  const response = await apiRequest<ProductListResponse>(buildProductsPath(filters), {
    authMode: "appwrite",
    parse: parseProductsResponse,
  });

  return response.data;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const response = await apiRequest<Product, BackendProductPayload>("/api/v1/products", {
    method: "POST",
    authMode: "appwrite",
    body: toBackendProductPayload(payload),
    parse: parseProduct,
  });

  return response.data;
}

export async function getProductById(id: string): Promise<Product> {
  const response = await apiRequest<Product>(`/api/v1/products/${id}`, {
    authMode: "appwrite",
    parse: parseProduct,
  });

  return response.data;
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const response = await apiRequest<Product, BackendProductPayload>(`/api/v1/products/${id}`, {
    method: "PATCH",
    authMode: "appwrite",
    body: toBackendProductPayload(payload),
    parse: parseProduct,
  });

  return response.data;
}

export async function updateProductStatus(
  id: string,
  payload: UpdateProductStatusPayload,
): Promise<Product> {
  const response = await apiRequest<Product, UpdateProductStatusPayload>(
    `/api/v1/products/${id}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseProduct,
    },
  );

  return response.data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiRequest<void>(`/api/v1/products/${id}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const response = await apiRequest<ProductVariant[]>(`/api/v1/products/${productId}/variants`, {
    authMode: "appwrite",
    parse: (data) => {
      if (!Array.isArray(data)) {
        throw new Error("Variants list payload is invalid.");
      }

      return data.map(parseVariant);
    },
  });

  return response.data;
}

export async function createProductVariant(
  productId: string,
  payload: CreateProductVariantPayload,
): Promise<ProductVariant> {
  const response = await apiRequest<ProductVariant, BackendProductVariantPayload>(
    `/api/v1/products/${productId}/variants`,
    {
      method: "POST",
      authMode: "appwrite",
      body: toBackendVariantPayload(payload),
      parse: parseVariant,
    },
  );

  return response.data;
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  payload: UpdateProductVariantPayload,
): Promise<ProductVariant> {
  const response = await apiRequest<ProductVariant, BackendProductVariantPayload>(
    `/api/v1/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: toBackendVariantPayload(payload),
      parse: parseVariant,
    },
  );

  return response.data;
}

export async function updateProductVariantStatus(
  productId: string,
  variantId: string,
  payload: UpdateProductVariantStatusPayload,
): Promise<ProductVariant> {
  const response = await apiRequest<ProductVariant, UpdateProductVariantStatusPayload>(
    `/api/v1/products/${productId}/variants/${variantId}/status`,
    {
      method: "PATCH",
      authMode: "appwrite",
      body: payload,
      parse: parseVariant,
    },
  );

  return response.data;
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  await apiRequest<void>(`/api/v1/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
    authMode: "appwrite",
    parse: () => undefined,
  });
}

export async function getProductReferenceData(): Promise<ProductReferenceData> {
  const [categoriesResult, unitsResult, taxRatesResult] = await Promise.allSettled([
    getProductCategoryReferences(),
    getUnitReferences(),
    getTaxRateReferences(),
  ]);

  return {
    categories: categoriesResult.status === "fulfilled" ? categoriesResult.value : [],
    units: unitsResult.status === "fulfilled" ? unitsResult.value : [],
    taxRates: taxRatesResult.status === "fulfilled" ? taxRatesResult.value : [],
  };
}
