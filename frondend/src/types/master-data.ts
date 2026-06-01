import type { RecordStatus } from "@/types/settings";

export type MasterDataOverview = {
  unitsCount: number;
  productCategoriesCount: number;
  ingredientCategoriesCount: number;
  packagingCategoriesCount: number;
  orderStatusesCount: number;
  paymentStatusesCount: number;
};

export type UnitCategory = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type Unit = {
  id: string;
  businessId: string | null;
  unitCategoryId: string;
  unitCategory: UnitCategory;
  unitName: string;
  symbol: string;
  baseUnitId: string | null;
  conversionFactor: number;
  decimalPrecision: number;
  isSystemDefault: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateUnitPayload = {
  unitCategoryId: string;
  unitName: string;
  symbol: string;
  baseUnitId: string | null;
  conversionFactor: number;
  decimalPrecision: number;
};

export type UpdateUnitPayload = Partial<CreateUnitPayload>;

export type ProductCategory = {
  id: string;
  businessId: string;
  parentCategoryId: string | null;
  categoryName: string;
  categoryCode: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateProductCategoryPayload = {
  parentCategoryId: string | null;
  categoryName: string;
  categoryCode: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

export type UpdateProductCategoryPayload = Partial<CreateProductCategoryPayload>;

export type UpdateMasterDataStatusPayload = {
  status: RecordStatus;
};

export type CategoryCopyType =
  | "product_categories"
  | "ingredient_categories"
  | "packaging_categories";

export type CopyCategoriesPayload = {
  categoryType: CategoryCopyType;
  sourceBranchId: string;
};

export type CopyCategoriesSkippedCategory = {
  categoryName: string;
  reason: string;
};

export type CopyCategoriesResult = {
  categoryType: CategoryCopyType;
  sourceBranchId: string;
  targetBranchId: string;
  createdCount: number;
  skippedCount: number;
  createdCategoryIds: string[];
  skippedCategories: CopyCategoriesSkippedCategory[];
};

export type SimpleCategory = {
  id: string;
  businessId: string;
  categoryName: string;
  description: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type ManageableSimpleCategoryCollection = Extract<
  MasterDataCollection,
  "ingredient-categories" | "packaging-categories"
>;

export type CreateSimpleCategoryPayload = {
  categoryName: string;
  description: string;
};

export type UpdateSimpleCategoryPayload = Partial<CreateSimpleCategoryPayload>;

export type OrderStatus = {
  id: string;
  businessId: string | null;
  statusName: string;
  statusKey: string;
  sortOrder: number;
  color: string;
  isSystemDefault: boolean;
  isFinalStatus: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderStatusPayload = {
  statusName: string;
  statusKey: string;
  sortOrder: number;
  color: string;
  isFinalStatus: boolean;
};

export type UpdateOrderStatusPayload = Partial<CreateOrderStatusPayload>;

export type PaymentStatus = {
  id: string;
  businessId: string | null;
  statusName: string;
  statusKey: string;
  color: string;
  isSystemDefault: boolean;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaymentStatusPayload = {
  statusName: string;
  statusKey: string;
  color: string;
};

export type UpdatePaymentStatusPayload = Partial<CreatePaymentStatusPayload>;

export type MasterDataCollection =
  | "units"
  | "product-categories"
  | "ingredient-categories"
  | "packaging-categories"
  | "order-statuses"
  | "payment-statuses";
