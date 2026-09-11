/**
 * Reference lists for forms, and the product picker.
 *
 * A form that may create a product must be able to name its category and
 * unit; a form that may write an order must be able to name a product and a
 * customer. Under strict permissions those lists no longer come from the
 * owning module's list endpoints (which require that module's view
 * permission) but from here:
 *
 *  - GET /api/v1/lookups?kinds=...   reference data, any signed-in user
 *  - GET /api/v1/products/picker      unlocked by the permissions whose forms
 *                                     pick a product (orders, purchasing, ...)
 *
 * Both return the same shapes as the module endpoints, so the parsers are
 * shared and nothing above this file changes type.
 */

import { parseBranch } from "@/lib/api/branches";
import { apiRequest } from "@/lib/api/client";
import {
  parseProductCategoryReference,
  parseProductsResponse,
  parseReferenceList,
  parseTaxRateReference,
  parseUnitReference,
} from "@/lib/api/products";
import { parseSalesChannel } from "@/lib/api/settings-data";
import type { Branch } from "@/types/branch";
import type { Unit } from "@/types/master-data";
import type { ProductListResponse, ProductType } from "@/types/product";
import type { SalesChannel, TaxRate } from "@/types/settings";

export type LookupKind =
  | "product_categories"
  | "units"
  | "order_statuses"
  | "payment_statuses"
  | "sales_channels"
  | "payment_methods"
  | "tax_rates"
  | "branches";

export type ProductCategoryOption = {
  allowedProductTypes: ProductType[];
  categoryName: string;
  id: string;
};

export type Lookups = {
  productCategories: ProductCategoryOption[];
  units: Unit[];
  salesChannels: SalesChannel[];
  taxRates: TaxRate[];
  branches: Branch[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function list<T>(raw: unknown, parser: (item: unknown) => T): T[] {
  return raw === undefined ? [] : parseReferenceList(raw, parser);
}

/** Fetch the requested reference lists. Kinds not requested come back empty. */
export async function getLookups(kinds: readonly LookupKind[]): Promise<Lookups> {
  const response = await apiRequest<Lookups>(
    `/api/v1/lookups?kinds=${encodeURIComponent(kinds.join(","))}`,
    {
      method: "GET",
      authMode: "appwrite",
      parse: (data) => {
        if (!isObject(data)) {
          throw new Error("Backend lookups payload is invalid.");
        }
        return {
          productCategories: list(data.product_categories, parseProductCategoryReference),
          units: list(data.units, parseUnitReference),
          salesChannels: list(data.sales_channels, parseSalesChannel),
          taxRates: list(data.tax_rates, parseTaxRateReference),
          branches: list(data.branches, parseBranch),
        };
      },
    },
  );

  return response.data;
}

export type ProductPickerParams = {
  search?: string;
  isSellable?: boolean;
  isPurchasable?: boolean;
  productType?: string;
  itemStructure?: string;
  page?: number;
  limit?: number;
};

/** Active products for a form's dropdown: search-driven, capped at 50. */
export async function getProductPicker(
  params: ProductPickerParams = {},
): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.isSellable !== undefined) {
    query.set("is_sellable", String(params.isSellable));
  }
  if (params.isPurchasable !== undefined) {
    query.set("is_purchasable", String(params.isPurchasable));
  }
  if (params.productType) {
    query.set("product_type", params.productType);
  }
  if (params.itemStructure) {
    query.set("item_structure", params.itemStructure);
  }
  if (params.page) {
    query.set("page", String(params.page));
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  const suffix = query.toString();
  const response = await apiRequest<ProductListResponse>(
    `/api/v1/products/picker${suffix ? `?${suffix}` : ""}`,
    {
      method: "GET",
      authMode: "appwrite",
      parse: parseProductsResponse,
    },
  );

  return response.data;
}
