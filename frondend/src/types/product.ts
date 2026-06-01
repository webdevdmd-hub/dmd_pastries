import type { Unit } from "@/types/master-data";
import type { RecordStatus, TaxRate } from "@/types/settings";

export type ProductType = "ready_to_sell" | "made_to_order" | "manufactured" | "retail" | "service";

export type ProductStatus = RecordStatus | "archived";

export type ProductVariant = {
  id: string;
  productId: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  costPrice: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  sortOrder: number;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  productName: string;
  productCode: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitName: string;
  taxRateId: string | null;
  taxRateName: string | null;
  productType: ProductType;
  salePrice: number;
  costPrice: number | null;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isPosVisible: boolean;
  isStockTracked: boolean;
  isExpiryTracked: boolean;
  isCustomOrderAvailable: boolean;
  preparationTimeMinutes: number | null;
  status: ProductStatus;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
};

export type ProductListFilters = {
  search: string;
  categoryId: string;
  productType: ProductType | "all";
  status: ProductStatus | "all";
  isPosVisible: "all" | "true" | "false";
  page: number;
  limit: number;
  sortBy: "created_at" | "updated_at" | "product_name" | "sale_price";
  sortOrder: "asc" | "desc";
};

export type CreateProductPayload = {
  productName: string;
  categoryId: string;
  unitId: string;
  taxRateId: string | null;
  productType: ProductType;
  salePrice: number;
  costPrice: number | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  imageFileId: string | null;
  isPosVisible: boolean;
  isStockTracked: boolean;
  isExpiryTracked: boolean;
  isCustomOrderAvailable: boolean;
  preparationTimeMinutes: number | null;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type UpdateProductStatusPayload = {
  status: ProductStatus;
};

export type CreateProductVariantPayload = {
  variantName: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  costPrice: number | null;
  imageUrl: string | null;
  imageFileId: string | null;
  sortOrder: number;
  status: RecordStatus;
};

export type UpdateProductVariantPayload = Partial<CreateProductVariantPayload>;

export type UpdateProductVariantStatusPayload = {
  status: RecordStatus;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

export type ProductReferenceData = {
  categories: { id: string; categoryName: string }[];
  units: Unit[];
  taxRates: TaxRate[];
};
