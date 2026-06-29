import type { Unit } from "@/types/master-data";
import type { RecordStatus, TaxRate } from "@/types/settings";

export const PRODUCT_TYPES = [
  "finished_product",
  "ingredient",
  "packaging",
  "raw_material",
  "semi_finished",
  "consumable",
  "equipment",
  "service",
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const ITEM_STRUCTURES = ["single", "variant", "recipe_based", "custom"] as const;

export type ItemStructure = (typeof ITEM_STRUCTURES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  finished_product: "Finished Product",
  ingredient: "Ingredient",
  packaging: "Packaging",
  raw_material: "Raw Material",
  semi_finished: "Semi-Finished",
  consumable: "Consumable",
  equipment: "Equipment",
  service: "Service",
};

export const ITEM_STRUCTURE_LABELS: Record<ItemStructure, string> = {
  single: "Single",
  variant: "Variant",
  recipe_based: "Recipe-Based",
  custom: "Custom",
};

export type ProductStatus = RecordStatus | "archived";
export type CostUpdatePolicy = "manual" | "latest_purchase" | "weighted_average" | "recipe_actual";
export type PricingType = "markup" | "margin";

export const COST_UPDATE_POLICY_LABELS: Record<CostUpdatePolicy, string> = {
  manual: "Manual",
  latest_purchase: "Latest purchase",
  weighted_average: "Weighted average",
  recipe_actual: "Recipe actual",
};

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  markup: "Markup",
  margin: "Margin",
};

export type ProductVariant = {
  id: string;
  productId: string;
  variantName: string;
  sku: string | null;
  barcode: string | null;
  salePrice: number;
  costPrice: number | null;
  costUpdatePolicy: CostUpdatePolicy;
  pricingType: PricingType;
  pricingPercent: number;
  minimumSalePrice: number | null;
  suggestedSalePrice: number | null;
  autoPriceUpdateEnabled: boolean;
  salePriceLocked: boolean;
  lastPurchaseCost: number | null;
  lastPurchaseDate: string | null;
  lastProductionCost: number | null;
  lastProductionDate: string | null;
  averageInventoryCost: number | null;
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
  itemStructure: ItemStructure;
  salePrice: number;
  costPrice: number | null;
  compareAtPrice: number | null;
  costUpdatePolicy: CostUpdatePolicy;
  pricingType: PricingType;
  pricingPercent: number;
  minimumSalePrice: number | null;
  suggestedSalePrice: number | null;
  autoPriceUpdateEnabled: boolean;
  salePriceLocked: boolean;
  lastPurchaseCost: number | null;
  lastPurchaseDate: string | null;
  lastProductionCost: number | null;
  lastProductionDate: string | null;
  averageInventoryCost: number | null;
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
  itemStructure: ItemStructure | "all";
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
  itemStructure: ItemStructure;
  salePrice: number;
  costPrice: number | null;
  costUpdatePolicy: CostUpdatePolicy;
  pricingType: PricingType;
  pricingPercent: number;
  minimumSalePrice: number | null;
  autoPriceUpdateEnabled: boolean;
  salePriceLocked: boolean;
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
  costUpdatePolicy: CostUpdatePolicy;
  pricingType: PricingType;
  pricingPercent: number;
  minimumSalePrice: number | null;
  autoPriceUpdateEnabled: boolean;
  salePriceLocked: boolean;
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
  categories: { allowedProductTypes: ProductType[]; categoryName: string; id: string }[];
  units: Unit[];
  taxRates: TaxRate[];
};

export type ProductPriceSuggestionStatus = "pending" | "applied" | "dismissed";

export type ProductPriceSuggestion = {
  id: string;
  productId: string;
  productVariantId: string | null;
  productName: string;
  variantName: string | null;
  currentCost: number;
  previousCost: number | null;
  currentSalePrice: number;
  suggestedSalePrice: number;
  pricingType: PricingType;
  pricingPercent: number;
  sourceType: string;
  sourceNumber: string | null;
  reason: string | null;
  status: ProductPriceSuggestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductPriceSuggestionListFilters = {
  status?: ProductPriceSuggestionStatus;
  page?: number;
  limit?: number;
};

export type ProductPriceSuggestionListResponse = {
  items: ProductPriceSuggestion[];
  total: number;
  page: number;
  limit: number;
};
